import { randomUUID } from 'crypto';
import { withTransaction } from '@/db/pool';
import { AppError } from '@/utils/AppError';
import { childLogger } from '@/utils/logger';
import { generateAccountNumber } from '@/utils/accountNumber';
import { fromScaledInt, toScaledInt } from '@/utils/money';
import { accountsRepository } from '@/modules/accounts/accounts.repository';
import { customersRepository } from '@/modules/customers/customers.repository';
import { transactionsRepository } from '@/modules/transactions/transactions.repository';
import {
  DepositInput,
  OpenAccountInput,
  SearchAccountsQuery,
  TransferInput,
  WithdrawInput,
} from '@/modules/accounts/accounts.schemas';

const log = childLogger('accounts-service');

export const accountsService = {
  async open(input: OpenAccountInput, performedBy: string) {
    const customer = await customersRepository.findById(input.customerId);
    if (!customer) throw AppError.notFound('Customer', input.customerId);
    if (customer.status !== 'ACTIVE') {
      throw AppError.badRequest(`Cannot open an account for a customer with status '${customer.status}'.`);
    }

    return withTransaction(async (client) => {
      // Account numbers are generated randomly and rely on the unique
      // constraint to catch the extremely rare collision; retrying a
      // handful of times keeps the request from failing a customer over
      // a one-in-ten-billion coincidence.
      let account = null;
      for (let attempt = 0; attempt < 5 && !account; attempt += 1) {
        try {
          account = await accountsRepository.create(
            {
              accountNumber: generateAccountNumber(),
              customerId: input.customerId,
              accountType: input.accountType,
              currencyCode: input.currencyCode,
              openingBalance: input.openingDeposit ?? '0.0000',
            },
            client,
          );
        } catch (err) {
          const pgErr = err as { code?: string };
          if (pgErr.code !== '23505' || attempt === 4) throw err;
        }
      }
      if (!account) throw AppError.internal('Could not generate a unique account number.');

      if (input.openingDeposit) {
        await transactionsRepository.insert(
          {
            accountId: account.account_id,
            transactionType: 'DEPOSIT',
            amount: input.openingDeposit,
            balanceAfter: account.balance,
            description: 'Opening deposit',
          },
          client,
        );
      }

      log.info({ accountId: account.account_id, customerId: input.customerId }, 'account opened');
      return account;
    }, performedBy);
  },

  async getById(accountId: string) {
    const account = await accountsRepository.findById(accountId);
    if (!account) throw AppError.notFound('Account', accountId);
    return account;
  },

  async listByCustomer(customerId: string) {
    const customer = await customersRepository.findById(customerId);
    if (!customer) throw AppError.notFound('Customer', customerId);
    return accountsRepository.listByCustomer(customerId);
  },

  async search(params: SearchAccountsQuery) {
    return accountsRepository.search(params);
  },

  async deposit(accountId: string, input: DepositInput, performedBy: string) {
    return withTransaction(async (client) => {
      const account = await accountsRepository.findByIdForUpdate(accountId, client);
      if (!account) throw AppError.notFound('Account', accountId);
      if (account.status !== 'ACTIVE') {
        throw AppError.badRequest(`Account is ${account.status.toLowerCase()} and cannot accept deposits.`);
      }

      const newBalance = fromScaledInt(toScaledInt(account.balance) + toScaledInt(input.amount));
      const updated = await accountsRepository.updateBalance(accountId, newBalance, client);
      const txn = await transactionsRepository.insert(
        {
          accountId,
          transactionType: 'DEPOSIT',
          amount: input.amount,
          balanceAfter: newBalance,
          description: input.description ?? 'Deposit',
        },
        client,
      );

      log.info({ accountId, amount: input.amount }, 'deposit completed');
      return { account: updated, transaction: txn };
    }, performedBy);
  },

  async withdraw(accountId: string, input: WithdrawInput, performedBy: string) {
    return withTransaction(async (client) => {
      const account = await accountsRepository.findByIdForUpdate(accountId, client);
      if (!account) throw AppError.notFound('Account', accountId);
      if (account.status !== 'ACTIVE') {
        throw AppError.badRequest(`Account is ${account.status.toLowerCase()} and cannot process withdrawals.`);
      }

      const currentScaled = toScaledInt(account.balance);
      const amountScaled = toScaledInt(input.amount);
      if (amountScaled > currentScaled) {
        throw AppError.insufficientFunds();
      }

      const newBalance = fromScaledInt(currentScaled - amountScaled);
      const updated = await accountsRepository.updateBalance(accountId, newBalance, client);
      const txn = await transactionsRepository.insert(
        {
          accountId,
          transactionType: 'WITHDRAWAL',
          amount: input.amount,
          balanceAfter: newBalance,
          description: input.description ?? 'Withdrawal',
        },
        client,
      );

      log.info({ accountId, amount: input.amount }, 'withdrawal completed');
      return { account: updated, transaction: txn };
    }, performedBy);
  },

  async transfer(fromAccountId: string, input: TransferInput, performedBy: string) {
    if (fromAccountId === input.toAccountId) {
      throw AppError.badRequest('Cannot transfer to the same account.');
    }

    return withTransaction(async (client) => {
      // Lock both rows in a fixed order (lexicographically by UUID)
      // regardless of which account is source vs. destination. This is
      // the standard technique for avoiding deadlocks when two concurrent
      // transfers involve the same pair of accounts in opposite
      // directions — without a fixed lock order, Transfer A→B and
      // Transfer B→A could each hold one lock and wait forever on the
      // other.
      const [firstId, secondId] = [fromAccountId, input.toAccountId].sort();
      const first = await accountsRepository.findByIdForUpdate(firstId, client);
      const second = await accountsRepository.findByIdForUpdate(secondId, client);

      const fromAccount = firstId === fromAccountId ? first : second;
      const toAccount = firstId === fromAccountId ? second : first;

      if (!fromAccount) throw AppError.notFound('Account', fromAccountId);
      if (!toAccount) throw AppError.notFound('Account', input.toAccountId);
      if (fromAccount.status !== 'ACTIVE') {
        throw AppError.badRequest(`Source account is ${fromAccount.status.toLowerCase()} and cannot send funds.`);
      }
      if (toAccount.status !== 'ACTIVE') {
        throw AppError.badRequest(`Destination account is ${toAccount.status.toLowerCase()} and cannot receive funds.`);
      }

      const amountScaled = toScaledInt(input.amount);
      const fromBalanceScaled = toScaledInt(fromAccount.balance);
      if (amountScaled > fromBalanceScaled) {
        throw AppError.insufficientFunds();
      }

      const newFromBalance = fromScaledInt(fromBalanceScaled - amountScaled);
      const newToBalance = fromScaledInt(toScaledInt(toAccount.balance) + amountScaled);

      const updatedFrom = await accountsRepository.updateBalance(fromAccountId, newFromBalance, client);
      const updatedTo = await accountsRepository.updateBalance(input.toAccountId, newToBalance, client);

      const transferGroupId = randomUUID();
      const outTxn = await transactionsRepository.insert(
        {
          accountId: fromAccountId,
          relatedAccountId: input.toAccountId,
          transactionType: 'TRANSFER_OUT',
          amount: input.amount,
          balanceAfter: newFromBalance,
          description: input.description ?? `Transfer to ${toAccount.account_number}`,
          transferGroupId,
        },
        client,
      );
      const inTxn = await transactionsRepository.insert(
        {
          accountId: input.toAccountId,
          relatedAccountId: fromAccountId,
          transactionType: 'TRANSFER_IN',
          amount: input.amount,
          balanceAfter: newToBalance,
          description: input.description ?? `Transfer from ${fromAccount.account_number}`,
          transferGroupId,
        },
        client,
      );

      log.info({ fromAccountId, toAccountId: input.toAccountId, amount: input.amount, transferGroupId }, 'transfer completed');
      return { fromAccount: updatedFrom, toAccount: updatedTo, outTransaction: outTxn, inTransaction: inTxn };
    }, performedBy);
  },
};

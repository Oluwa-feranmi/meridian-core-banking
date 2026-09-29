-- =============================================================================
-- Meridian Core Banking Platform
-- Migration 003: Seed data (local/dev only — do not run against a real
--                 deployed environment you plan to demo integrity claims
--                 against; this exists purely so the frontend has
--                 something to search/display immediately after `docker
--                 compose up`).
-- =============================================================================

-- Session variable so the audit trigger attributes these rows to 'seed'
-- rather than 'system', making seed-generated audit rows easy to spot and
-- filter out later.
SET LOCAL meridian.performed_by = 'seed';

-- -----------------------------------------------------------------------------
-- Customers
-- -----------------------------------------------------------------------------
INSERT INTO customers (customer_id, first_name, last_name, email, phone_number, date_of_birth, address_line1, city, state_province, postal_code, country, status)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Amara',  'Okafor',   'amara.okafor@example.com',   '+1-555-0101', '1988-04-12', '12 Baker Street',    'London',    'England',    'NW1 6XE', 'United Kingdom', 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222222', 'Daniel', 'Reyes',    'daniel.reyes@example.com',   '+1-555-0102', '1979-11-03', '48 Elm Avenue',      'Austin',    'Texas',      '73301',   'United States',  'ACTIVE'),
    ('33333333-3333-3333-3333-333333333333', 'Yuki',   'Tanaka',   'yuki.tanaka@example.com',    '+1-555-0103', '1995-07-22', '3 Sakura Chome',     'Osaka',     'Osaka',      '530-0001','Japan',          'ACTIVE'),
    ('44444444-4444-4444-4444-444444444444', 'Priya',  'Natarajan','priya.natarajan@example.com','+1-555-0104', '1990-02-17', '77 MG Road',         'Bengaluru', 'Karnataka',  '560001',  'India',          'ACTIVE'),
    ('55555555-5555-5555-5555-555555555555', 'Lucas',  'Meyer',    'lucas.meyer@example.com',    '+1-555-0105', '1985-09-30', '19 Rue de Rivoli',   'Paris',     'Ile-de-France','75001', 'France',         'SUSPENDED')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Accounts
-- -----------------------------------------------------------------------------
INSERT INTO accounts (account_id, account_number, customer_id, account_type, currency_code, balance, status)
VALUES
    ('aaaaaaa1-0000-0000-0000-000000000001', 'MER-0000000001', '11111111-1111-1111-1111-111111111111', 'CHECKING', 'USD', 2450.00, 'ACTIVE'),
    ('aaaaaaa1-0000-0000-0000-000000000002', 'MER-0000000002', '11111111-1111-1111-1111-111111111111', 'SAVINGS',  'USD', 15320.75,'ACTIVE'),
    ('aaaaaaa1-0000-0000-0000-000000000003', 'MER-0000000003', '22222222-2222-2222-2222-222222222222', 'CHECKING', 'USD', 875.20,  'ACTIVE'),
    ('aaaaaaa1-0000-0000-0000-000000000004', 'MER-0000000004', '33333333-3333-3333-3333-333333333333', 'CHECKING', 'USD', 5000.00, 'ACTIVE'),
    ('aaaaaaa1-0000-0000-0000-000000000005', 'MER-0000000005', '44444444-4444-4444-4444-444444444444', 'SAVINGS',  'USD', 32100.10,'ACTIVE'),
    ('aaaaaaa1-0000-0000-0000-000000000006', 'MER-0000000006', '55555555-5555-5555-5555-555555555555', 'CHECKING', 'USD', 0.00,    'FROZEN')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Transactions
-- A believable small history: an initial deposit per account, then one
-- transfer pair between Amara's checking and savings accounts.
-- -----------------------------------------------------------------------------
INSERT INTO transactions (transaction_id, account_id, related_account_id, transaction_type, amount, balance_after, description, status, transfer_group_id, created_at)
VALUES
    ('bbbbbbb1-0000-0000-0000-000000000001', 'aaaaaaa1-0000-0000-0000-000000000001', NULL, 'DEPOSIT', 2500.00, 2500.00, 'Initial funding', 'COMPLETED', NULL, now() - interval '10 days'),
    ('bbbbbbb1-0000-0000-0000-000000000002', 'aaaaaaa1-0000-0000-0000-000000000001', NULL, 'WITHDRAWAL', 50.00, 2450.00, 'ATM withdrawal', 'COMPLETED', NULL, now() - interval '3 days'),
    ('bbbbbbb1-0000-0000-0000-000000000003', 'aaaaaaa1-0000-0000-0000-000000000002', NULL, 'DEPOSIT', 15320.75, 15320.75, 'Initial funding', 'COMPLETED', NULL, now() - interval '10 days'),
    ('bbbbbbb1-0000-0000-0000-000000000004', 'aaaaaaa1-0000-0000-0000-000000000003', NULL, 'DEPOSIT', 875.20, 875.20, 'Initial funding', 'COMPLETED', NULL, now() - interval '9 days'),
    ('bbbbbbb1-0000-0000-0000-000000000005', 'aaaaaaa1-0000-0000-0000-000000000004', NULL, 'DEPOSIT', 5000.00, 5000.00, 'Initial funding', 'COMPLETED', NULL, now() - interval '8 days'),
    ('bbbbbbb1-0000-0000-0000-000000000006', 'aaaaaaa1-0000-0000-0000-000000000005', NULL, 'DEPOSIT', 32100.10, 32100.10, 'Initial funding', 'COMPLETED', NULL, now() - interval '7 days'),
    ('bbbbbbb1-0000-0000-0000-000000000007', 'aaaaaaa1-0000-0000-0000-000000000001', 'aaaaaaa1-0000-0000-0000-000000000002', 'TRANSFER_OUT', 200.00, 2450.00, 'Transfer to savings', 'COMPLETED', 'ccccccc1-0000-0000-0000-000000000001', now() - interval '1 day'),
    ('bbbbbbb1-0000-0000-0000-000000000008', 'aaaaaaa1-0000-0000-0000-000000000002', 'aaaaaaa1-0000-0000-0000-000000000001', 'TRANSFER_IN',  200.00, 15320.75,'Transfer from checking', 'COMPLETED', 'ccccccc1-0000-0000-0000-000000000001', now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- API users (staff)
-- Password for BOTH seed users is: "ChangeMe123!" — bcrypt hash below.
-- This is a fixed, publicly-known dev-only credential. Rotate/remove before
-- any environment is exposed beyond your own local testing.
-- Hash: $2b$12$3EryPMaswVtVOKvmNvs9iOS9GlmYm2l19D/.TLLfg9417efOWl0hK
-- -----------------------------------------------------------------------------
INSERT INTO api_users (user_id, username, password_hash, role, is_active)
VALUES
    ('ddddddd1-0000-0000-0000-000000000001', 'admin',  '$2b$12$3EryPMaswVtVOKvmNvs9iOS9GlmYm2l19D/.TLLfg9417efOWl0hK', 'ADMIN',  true),
    ('ddddddd1-0000-0000-0000-000000000002', 'teller1', '$2b$12$3EryPMaswVtVOKvmNvs9iOS9GlmYm2l19D/.TLLfg9417efOWl0hK', 'TELLER', true)
ON CONFLICT DO NOTHING;

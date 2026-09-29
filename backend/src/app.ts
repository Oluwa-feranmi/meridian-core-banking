import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from '@/config';
import { requestLogger } from '@/middleware/requestLogger';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { healthRouter } from '@/modules/health/health.routes';
import { authRouter } from '@/modules/auth/auth.routes';
import { customersRouter } from '@/modules/customers/customers.routes';
import { accountsRouter } from '@/modules/accounts/accounts.routes';
import { transactionsRouter } from '@/modules/transactions/transactions.routes';

export function createApp(): Application {
  const app = express();

  // Trust the ALB's X-Forwarded-* headers so req.ip and req.secure reflect
  // the real client, not the load balancer itself.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  // Health endpoints are intentionally excluded from rate limiting and
  // auth — the ALB polls /health/ready every few seconds and must never
  // be throttled or challenged for credentials.
  app.use('/health', healthRouter);
  app.use('/api/health', healthRouter);

  const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
  });
  app.use('/api', apiLimiter);

  app.use('/api/auth', authRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/transactions', transactionsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

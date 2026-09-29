import { createApp } from '@/app';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { pool } from '@/db/pool';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'Meridian Core Banking API listening');
});

// Graceful shutdown: ECS sends SIGTERM before killing a task during
// deploys or scale-in. Without this, in-flight requests get dropped
// mid-transaction and the ALB briefly routes to a dead task. Stop
// accepting new connections, let in-flight ones finish, then close the DB
// pool cleanly.
async function shutdown(signal: string) {
  logger.info({ signal }, 'shutdown signal received, closing server');
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'error while closing HTTP server');
      process.exitCode = 1;
    }
    try {
      await pool.end();
      logger.info('database pool closed, exiting');
    } catch (poolErr) {
      logger.error({ err: poolErr }, 'error while closing database pool');
    }
    process.exit();
  });

  // Safety net: if connections don't drain within 10s, force exit rather
  // than hang and get SIGKILLed with no log line.
  setTimeout(() => {
    logger.warn('forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaught exception');
  process.exit(1);
});

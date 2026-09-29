import pino from 'pino';
import { config } from '@/config';

// Structured (JSON) logging is deliberate, not cosmetic: this is exactly
// the format the ECS `awslogs` driver ships to CloudWatch Logs, and JSON
// fields (level, msg, module, requestId, ...) are what CloudWatch Logs
// Insights queries filter on. Human-readable pretty-printing is used only
// in local development.
export const logger = pino({
  level: config.logLevel,
  base: { service: 'meridian-core-banking-api', env: config.env },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    config.env === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});

export function childLogger(module: string) {
  return logger.child({ module });
}

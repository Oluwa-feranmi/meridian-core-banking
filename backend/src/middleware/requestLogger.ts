import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import { logger } from '@/utils/logger';

// Every request gets a unique X-Request-Id, generated here if the caller
// (or an upstream ALB) didn't already supply one. It's echoed back in the
// response header and included in every log line and error response for
// that request, so a support engineer can grep CloudWatch Logs Insights
// for one request's full lifecycle across services.
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const id = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Never log request/response bodies by default — account balances,
  // JWTs, and password hashes must not end up in CloudWatch Logs.
  serializers: {
    req: (req) => ({ method: req.method, url: req.url, id: req.id }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

import { Router } from 'express';
import { checkDatabaseConnection } from '@/db/pool';

export const healthRouter = Router();

// Liveness: "is the process up and able to respond at all." Used by the
// ECS container health check (fast, no external dependency — if this
// endpoint hangs, the container itself is unhealthy, not just the DB).
healthRouter.get('/live', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness: "is the process ready to serve real traffic." Used by the
// ALB target group health check — a task that's up but can't reach its
// database should be pulled out of rotation, not sent requests.
healthRouter.get('/ready', async (_req, res) => {
  const dbHealthy = await checkDatabaseConnection();
  if (!dbHealthy) {
    res.status(503).json({ status: 'unhealthy', checks: { database: 'down' } });
    return;
  }
  res.status(200).json({ status: 'ok', checks: { database: 'up' } });
});

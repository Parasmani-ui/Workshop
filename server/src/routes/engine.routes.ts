/**
 * @fileoverview Routes for triggering and monitoring the simulation engine.
 * Mounted at /api/engine in app.ts.
 *
 * Note: Engine processing is primarily triggered via game.controller's
 * processQuarter endpoint (PATCH /api/games/:gameId/process).
 * This router exists for direct engine diagnostics/status if needed.
 */

import { Router, Request, Response } from 'express';
import { testRunHandler } from '../controllers/engine.controller';

export const engineRouter = Router();

engineRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Engine service is available' });
});

// Development-only: POST /api/engine/test-run
// Runs a single quarter end-to-end and returns a per-team summary.
// Intentionally unguarded — this server has no auth middleware today;
// remove or protect before deploying to anything non-local.
if (process.env.NODE_ENV !== 'production') {
  engineRouter.post('/test-run', testRunHandler);
}

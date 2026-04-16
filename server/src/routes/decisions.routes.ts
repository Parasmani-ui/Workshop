/**
 * @fileoverview Routes for team decision submission and retrieval per quarter.
 * Nested under /api/games/:gameId/decisions via games.routes.ts.
 */

import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { decisionSchema } from '../validators/decision.validator';
import * as decisionCtrl from '../controllers/decision.controller';

export const decisionsRouter = Router({ mergeParams: true });

decisionsRouter.post('/', validateBody(decisionSchema), decisionCtrl.submitDecision);
decisionsRouter.get('/:quarterNo', decisionCtrl.getDecisions);
decisionsRouter.get('/:teamNo/:quarterNo', decisionCtrl.getTeamDecision);
decisionsRouter.patch('/:teamNo/:quarterNo/lock', decisionCtrl.lockTeamDecision);

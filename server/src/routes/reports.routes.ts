/**
 * @fileoverview Routes for Management Reports (P&L, Balance Sheet, Cash Flow) and Sector Update.
 * Nested under /api/games/:gameId/reports via games.routes.ts.
 */

import { Router } from 'express';
import * as reportCtrl from '../controllers/report.controller';

export const reportsRouter = Router({ mergeParams: true });

reportsRouter.get('/sector/:quarterNo', reportCtrl.getSectorUpdate);
reportsRouter.get('/:teamNo/:quarterNo', reportCtrl.getTeamReport);

// Leaderboard mounted at /api/games/:gameId/leaderboard (in games.routes.ts parent)

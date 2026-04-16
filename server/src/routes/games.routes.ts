/**
 * @fileoverview Routes for game CRUD operations — create, list, update status.
 * Mounted at /api/games in app.ts.
 * Sub-routes for teams, decisions, and reports are nested under /:gameId/.
 */

import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { createGameSchema } from '../validators/game.validator';
import * as gameCtrl from '../controllers/game.controller';
import * as reportCtrl from '../controllers/report.controller';

// Sub-routers (nested under /api/games/:gameId/...)
import { teamsRouter } from './teams.routes';
import { decisionsRouter } from './decisions.routes';
import { reportsRouter } from './reports.routes';

export const gamesRouter = Router();

// ---- Game CRUD ----
gamesRouter.get('/', gameCtrl.getGames);
gamesRouter.post('/', validateBody(createGameSchema), gameCtrl.createGame);
gamesRouter.get('/:gameId', gameCtrl.getGameById);
gamesRouter.delete('/:gameId', gameCtrl.deleteGame);
gamesRouter.get('/:gameId/status', gameCtrl.getGameStatus);

// ---- Game activation ----
gamesRouter.patch('/:gameId/activate', gameCtrl.activateGame);

// ---- Quarter lifecycle ----
gamesRouter.patch('/:gameId/lock', gameCtrl.lockQuarter);
gamesRouter.patch('/:gameId/process', gameCtrl.processQuarter);
gamesRouter.patch('/:gameId/publish', gameCtrl.publishResults);

// ---- Leaderboard ----
gamesRouter.get('/:gameId/leaderboard', reportCtrl.getLeaderboard);

// ---- Nested sub-routes ----
gamesRouter.use('/:gameId/teams', teamsRouter);
gamesRouter.use('/:gameId/decisions', decisionsRouter);
gamesRouter.use('/:gameId/reports', reportsRouter);

/**
 * @fileoverview Routes for team management within a game.
 * Nested under /api/games/:gameId/teams via games.routes.ts.
 */

import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { createTeamSchema } from '../validators/game.validator';
import * as teamCtrl from '../controllers/team.controller';

export const teamsRouter = Router({ mergeParams: true });

teamsRouter.get('/', teamCtrl.getTeams);
teamsRouter.post('/', validateBody(createTeamSchema), teamCtrl.createTeam);
teamsRouter.patch('/:teamNo', teamCtrl.updateTeam);
teamsRouter.delete('/:teamNo', teamCtrl.deleteTeam);

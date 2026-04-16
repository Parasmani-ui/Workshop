/**
 * @fileoverview Routes for scenario (GAMEAID + PRODS + FORECAST) management.
 * Mounted at /api/scenarios in app.ts.
 */

import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { scenarioSchema } from '../validators/scenario.validator';
import * as scenarioCtrl from '../controllers/scenario.controller';

export const scenariosRouter = Router();

scenariosRouter.get('/', scenarioCtrl.getScenarios);
scenariosRouter.get('/:name', scenarioCtrl.getScenarioByName);
scenariosRouter.post('/', validateBody(scenarioSchema), scenarioCtrl.createScenario);

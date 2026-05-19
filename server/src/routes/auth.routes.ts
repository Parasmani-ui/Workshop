/**
 * @fileoverview Auth routes — register, login, me, joinGame.
 * Mounted at /api/auth in app.ts.
 */

import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import {
  registerSchema,
  loginSchema,
  joinGameSchema,
} from '../validators/auth.validator';
import * as authCtrl from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), authCtrl.register);
authRouter.post('/login', validateBody(loginSchema), authCtrl.login);
authRouter.get('/me', requireAuth, authCtrl.me);
authRouter.get('/my-games', requireAuth, authCtrl.myGames);
authRouter.post('/join-game', requireAuth, validateBody(joinGameSchema), authCtrl.joinGame);

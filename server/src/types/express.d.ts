/**
 * @fileoverview Extends the Express Request interface with custom properties
 * used by authentication middleware and game-scoped routes.
 */

declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: 'facilitator' | 'team';
      name: string;
    };
    gameId?: string;
  }
}

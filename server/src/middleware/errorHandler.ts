/**
 * @fileoverview Global Express error-handling middleware.
 * Catches all errors passed via next(err) and returns a consistent JSON response.
 * Hides stack traces in production.
 */

import { Request, Response, NextFunction } from 'express';

interface ErrorResponse {
  success: false;
  message: string;
  stack?: string;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  const response: ErrorResponse = {
    success: false,
    message: err.message || 'Internal Server Error',
  };

  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

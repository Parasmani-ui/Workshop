/**
 * @fileoverview Generic Zod validation middleware factory.
 * Wraps any Zod schema into Express middleware that validates req.body.
 * Returns 400 with structured errors on validation failure.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const zodError = result.error as ZodError;
      res.status(400).json({
        success: false,
        errors: zodError.errors,
      });
      return;
    }

    req.body = result.data;
    next();
  };
}

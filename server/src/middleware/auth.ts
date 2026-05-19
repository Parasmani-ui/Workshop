/**
 * @fileoverview JWT authentication middleware.
 * Verifies the Authorization: Bearer <token> header and attaches the decoded
 * user payload to req.user. Use requireRole() to restrict to a specific role.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface AuthUserPayload {
  id: string;
  email: string;
  role: 'facilitator' | 'team';
  name: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function requireRole(role: 'facilitator' | 'team') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ success: false, message: `Forbidden: ${role} role required` });
      return;
    }
    next();
  };
}

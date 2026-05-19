/**
 * @fileoverview Zod schemas for auth requests (register, login, joinGame).
 */

import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['facilitator', 'team']),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const joinGameSchema = z.object({
  gameId: z.string().min(1, 'Game ID is required'),
  teamNo: z.number().int().min(0).max(19),
  teamName: z.string().min(1).max(100).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type JoinGameInput = z.infer<typeof joinGameSchema>;

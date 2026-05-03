/**
 * @fileoverview Environment configuration loader.
 * Reads from process.env (populated by dotenv) and exports a typed config object.
 * Throws immediately if required variables are missing.
 */

import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: requireEnv('MONGODB_URI'),
  JWT_SECRET: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
} as const;

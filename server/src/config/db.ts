/**
 * @fileoverview MongoDB connection handler using Mongoose.
 * Connects to the URI specified in the environment config.
 * Logs success or exits the process on failure.
 */

import mongoose from 'mongoose';
import { config } from './env';

export async function connectDB(): Promise<void> {
  try {
    const conn = await mongoose.connect(config.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * User Model
 * Maps to: user authentication (new — no legacy FoxPro equivalent)
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser {
  email: string;
  password: string;
  role: 'facilitator' | 'team';
  name: string;
  createdAt: Date;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['facilitator', 'team'], required: true },
    name: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Stub — will use bcrypt.compare once auth is implemented
UserSchema.methods.comparePassword = async function (
  this: IUserDocument,
  _candidate: string
): Promise<boolean> {
  return false;
};

export const User = mongoose.model<IUserDocument>('User', UserSchema);

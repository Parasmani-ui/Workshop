/**
 * Team Model
 * Maps to: team records in legacy FoxPro system
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface ITeam {
  gameId: string;
  teamNo: number;
  teamName: string;
  ceo: string;
  cfo: string;
  coo: string;
  cmo: string;
  isActive: boolean;
  userId?: mongoose.Types.ObjectId;
}

export interface ITeamDocument extends ITeam, Document {}

const TeamSchema = new Schema<ITeamDocument>(
  {
    gameId: { type: String, required: true },
    teamNo: { type: Number, required: true, min: 0, max: 19 },
    teamName: { type: String, required: true },
    ceo: { type: String },
    cfo: { type: String },
    coo: { type: String },
    cmo: { type: String },
    isActive: { type: Boolean, default: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

TeamSchema.index({ gameId: 1, teamNo: 1 }, { unique: true });
TeamSchema.index({ userId: 1 });

export const Team = mongoose.model<ITeamDocument>('Team', TeamSchema);

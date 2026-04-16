/**
 * Game Model
 * Maps to: GAMEAID.DBF (game session config) in legacy FoxPro system
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface IGame {
  gameId: string;
  name: string;
  scenarioId: mongoose.Types.ObjectId;
  status: 'setup' | 'active' | 'processing' | 'completed';
  currentQuarter: number;
  maxQuarters: number;
  winCriteria: 'M' | 'N' | 'P' | 'E' | 'V' | 'A' | 'B' | 'C' | 'O';
  facilitatorId: string;
  noOfTeams: number;
  createdAt: Date;
}

export interface IGameDocument extends IGame, Document {
  isQuarterLocked(): boolean;
}

const GameSchema = new Schema<IGameDocument>(
  {
    gameId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    scenarioId: { type: Schema.Types.ObjectId, ref: 'Scenario' },
    status: {
      type: String,
      enum: ['setup', 'active', 'processing', 'completed'],
      default: 'setup',
    },
    currentQuarter: { type: Number, default: 0 },
    maxQuarters: { type: Number, default: 5 },
    winCriteria: {
      type: String,
      enum: ['M', 'N', 'P', 'E', 'V', 'A', 'B', 'C', 'O'],
      required: true,
    },
    facilitatorId: { type: String },
    noOfTeams: { type: Number, required: true, min: 2, max: 20 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

GameSchema.methods.isQuarterLocked = function (this: IGameDocument): boolean {
  return this.status === 'processing' || this.status === 'completed';
};

export const Game = mongoose.model<IGameDocument>('Game', GameSchema);

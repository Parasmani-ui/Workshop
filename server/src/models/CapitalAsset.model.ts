/**
 * CapitalAsset Model
 * Maps to: CAPHED.DBF in legacy FoxPro system
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface ICapitalAsset {
  gameId: string;
  teamNo: number;
  quarterNo: number;
  capNo: number;           // asset number
  capType: 'P' | 'M' | 'A' | 'B' | 'C' | 'D';  // P=Plant, M=Machine
  units: number;
  pucost: number;          // per unit cost
  purval: number;          // purchase value
  life: number;            // life in quarters
  deprec: number;          // depreciation per quarter
  cumdep: number;          // accumulated depreciation
  endsin: number;          // quarter it retires
  curbkval: number;        // current book value
  age: number;             // quarters old
  startsin: number;        // quarter purchased
  pusalep: number;         // sale price if sold
  saleval: number;         // actual sale value
}

export interface ICapitalAssetDocument extends ICapitalAsset, Document {}

const CapitalAssetSchema = new Schema<ICapitalAssetDocument>(
  {
    gameId: { type: String, required: true },
    teamNo: { type: Number, required: true },
    quarterNo: { type: Number, required: true },
    capNo: { type: Number },
    capType: {
      type: String,
      enum: ['P', 'M', 'A', 'B', 'C', 'D'],
    },
    units: { type: Number, default: 0 },
    pucost: { type: Number, default: 0 },
    purval: { type: Number, default: 0 },
    life: { type: Number, default: 0 },
    deprec: { type: Number, default: 0 },
    cumdep: { type: Number, default: 0 },
    endsin: { type: Number, default: 0 },
    curbkval: { type: Number, default: 0 },
    age: { type: Number, default: 0 },
    startsin: { type: Number, default: 0 },
    pusalep: { type: Number, default: 0 },
    saleval: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CapitalAssetSchema.index({ gameId: 1, teamNo: 1, quarterNo: 1, capNo: 1 });

export const CapitalAsset = mongoose.model<ICapitalAssetDocument>(
  'CapitalAsset',
  CapitalAssetSchema
);

/**
 * Decision Model
 * Maps to: DTABLE.DBF in legacy FoxPro system
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface IDecision {
  // === META ===
  gameId: string;
  teamNo: number;
  quarterNo: number;
  submittedAt: Date;
  isLocked: boolean;

  // === PRODUCTION ===
  prod1: number;
  prod2: number;
  prod3: number;
  prod4: number;
  price1: number;
  price2: number;
  price3: number;
  price4: number;
  raw1: number;
  raw2: number;

  // === MARKETING ===
  fsad1: number;
  fsad2: number;
  fsad3: number;
  fsad4: number;
  vsad1: number;
  vsad2: number;
  vsad3: number;
  vsad4: number;
  dscnt1: number;
  dscnt2: number;
  dscnt3: number;
  dscnt4: number;

  // === CAPACITY ===
  newPCap: number;
  newMCap: number;

  // === FINANCE ===
  stl: number;
  ntwLoan: number;
  nthLoan: number;
  nBond: number;
  equDiv: number;
  equNo: number;
  equPri: number;
  prefNo: number;
  prefPri: number;

  // === R&D ===
  rand1: number;
  rand2: number;

  // === CONTRACTS ===
  crPrd: number;
  alliance1: number;
  alliance2: number;
  alliance3: number;
  alliance4: number;
  conAward1: number;
  conAward2: number;
  conAward3: number;
  conAward4: number;
  cprod1: number;
  cprod2: number;
  cprod3: number;
  cprod4: number;
  cprice1: number;
  cprice2: number;
  cprice3: number;
  cprice4: number;

  // === OTHER ===
  mesage: string;
  macsale: number;
  plasale: number;
  strset: number;
  bdisc: number;
  train1: number;
  train2: number;
  train3: number;
  train4: number;

  // === INVESTMENTS ===
  /**
   * Disinvestment from short-term investments (FD/MF) in rupees. Maps to
   * legacy DTABLE.STINVT — a negative value there indicates disinvestment
   * and is stored here as a positive cash inflow. Beer scenario uses this;
   * default 0 keeps MPX / Paper decisions unchanged.
   */
  invsale?: number;
}

export interface IDecisionDocument extends IDecision, Document {}

const DecisionSchema = new Schema<IDecisionDocument>(
  {
    // === PRODUCTION ===
    prod1: { type: Number, default: 0 },
    prod2: { type: Number, default: 0 },
    prod3: { type: Number, default: 0 },
    prod4: { type: Number, default: 0 },
    price1: { type: Number, default: 0 },
    price2: { type: Number, default: 0 },
    price3: { type: Number, default: 0 },
    price4: { type: Number, default: 0 },
    raw1: { type: Number, default: 0 },
    raw2: { type: Number, default: 0 },

    // === MARKETING ===
    fsad1: { type: Number, default: 0 }, // Fixed S&A
    fsad2: { type: Number, default: 0 },
    fsad3: { type: Number, default: 0 },
    fsad4: { type: Number, default: 0 },
    vsad1: { type: Number, default: 0 }, // Variable S&A
    vsad2: { type: Number, default: 0 },
    vsad3: { type: Number, default: 0 },
    vsad4: { type: Number, default: 0 },
    dscnt1: { type: Number, default: 0 }, // Cash discounts %
    dscnt2: { type: Number, default: 0 },
    dscnt3: { type: Number, default: 0 },
    dscnt4: { type: Number, default: 0 },

    // === CAPACITY ===
    newPCap: { type: Number, default: 0 }, // new plant capacity units
    newMCap: { type: Number, default: 0 }, // new machine capacity units

    // === FINANCE ===
    stl: { type: Number, default: 0 },      // short-term loan
    ntwLoan: { type: Number, default: 0 },   // 2-year loan
    nthLoan: { type: Number, default: 0 },   // 3-year loan
    nBond: { type: Number, default: 0 },     // new bonds
    equDiv: { type: Number, default: 0 },    // equity dividend per share
    equNo: { type: Number, default: 0 },     // new equity shares to issue
    equPri: { type: Number, default: 0 },    // equity issue price
    prefNo: { type: Number, default: 0 },    // preference shares
    prefPri: { type: Number, default: 0 },   // preference issue price

    // === R&D ===
    rand1: { type: Number, default: 0 },     // R&D Type 1 — image/product
    rand2: { type: Number, default: 0 },     // R&D Type 2 — RM reduction

    // === CONTRACTS ===
    crPrd: { type: Number, default: 0 },     // contract product number
    alliance1: { type: Number, default: 0 },
    alliance2: { type: Number, default: 0 },
    alliance3: { type: Number, default: 0 },
    alliance4: { type: Number, default: 0 },
    conAward1: { type: Number, default: 0 },
    conAward2: { type: Number, default: 0 },
    conAward3: { type: Number, default: 0 },
    conAward4: { type: Number, default: 0 },
    cprod1: { type: Number, default: 0 },
    cprod2: { type: Number, default: 0 },
    cprod3: { type: Number, default: 0 },
    cprod4: { type: Number, default: 0 },
    cprice1: { type: Number, default: 0 },
    cprice2: { type: Number, default: 0 },
    cprice3: { type: Number, default: 0 },
    cprice4: { type: Number, default: 0 },

    // === OTHER ===
    mesage: { type: String, default: '' },    // team message for the quarter
    macsale: { type: Number, default: 0 },    // machine to sell
    plasale: { type: Number, default: 0 },    // plant to sell
    strset: { type: Number, default: 0 },     // strike settlement code
    bdisc: { type: Number, default: 0 },      // bills discounting
    train1: { type: Number, default: 0 },
    train2: { type: Number, default: 0 },
    train3: { type: Number, default: 0 },
    train4: { type: Number, default: 0 },

    // === INVESTMENTS ===
    invsale: { type: Number, default: 0 },    // disinvestment (Rs) — legacy STINVT

    // === META ===
    gameId: { type: String, required: true },
    teamNo: { type: Number, required: true },
    quarterNo: { type: Number, required: true },
    submittedAt: { type: Date, default: Date.now },
    isLocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

DecisionSchema.index({ gameId: 1, teamNo: 1, quarterNo: 1 }, { unique: true });

export const Decision = mongoose.model<IDecisionDocument>('Decision', DecisionSchema);

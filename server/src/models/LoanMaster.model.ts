/**
 * LoanMaster + LoanDetail Models
 * Maps to: LOANTAB.DBF + LOANDET.DBF in legacy FoxPro system
 */
import mongoose, { Document, Schema } from 'mongoose';

// ---------- LoanMaster (LOANTAB) ----------

export interface ILoanMaster {
  gameId: string;
  teamNo: number;
  quarterNo: number;
  loanNo: number;
  lamount: number;         // loan amount
  intrate: number;         // interest rate %
  duration: number;        // quarters
  amountdue: number;
  emi: number;
  endsin: number;          // quarter it ends
  loanType: 'STL' | '2YR' | '3YR' | 'BOND' | 'SHARK';
}

export interface ILoanMasterDocument extends ILoanMaster, Document {}

const LoanMasterSchema = new Schema<ILoanMasterDocument>(
  {
    gameId: { type: String, required: true },
    teamNo: { type: Number, required: true },
    quarterNo: { type: Number, required: true },
    loanNo: { type: Number },
    lamount: { type: Number, default: 0 },
    intrate: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    amountdue: { type: Number, default: 0 },
    emi: { type: Number, default: 0 },
    endsin: { type: Number, default: 0 },
    loanType: {
      type: String,
      enum: ['STL', '2YR', '3YR', 'BOND', 'SHARK'],
    },
  },
  { timestamps: true }
);

LoanMasterSchema.index({ gameId: 1, teamNo: 1, quarterNo: 1, loanNo: 1 });

export const LoanMaster = mongoose.model<ILoanMasterDocument>('LoanMaster', LoanMasterSchema);

// ---------- LoanDetail (LOANDET) ----------

export interface ILoanDetail {
  gameId: string;
  teamNo: number;
  quarterNo: number;
  loanNo: number;
  amount: number;
  intpart: number;         // interest portion
  pripart: number;         // principal portion
  duethis: number;         // due this quarter
  duenext: number;         // due next quarter
  intrate: number;
  endsin: number;
  duration: number;
}

export interface ILoanDetailDocument extends ILoanDetail, Document {}

const LoanDetailSchema = new Schema<ILoanDetailDocument>(
  {
    gameId: { type: String, required: true },
    teamNo: { type: Number, required: true },
    quarterNo: { type: Number, required: true },
    loanNo: { type: Number },
    amount: { type: Number, default: 0 },
    intpart: { type: Number, default: 0 },
    pripart: { type: Number, default: 0 },
    duethis: { type: Number, default: 0 },
    duenext: { type: Number, default: 0 },
    intrate: { type: Number, default: 0 },
    endsin: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
  },
  { timestamps: true }
);

LoanDetailSchema.index({ gameId: 1, teamNo: 1, quarterNo: 1, loanNo: 1 });

export const LoanDetail = mongoose.model<ILoanDetailDocument>('LoanDetail', LoanDetailSchema);

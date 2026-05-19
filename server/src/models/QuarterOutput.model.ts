/**
 * QuarterOutput Model
 * Maps to: PANDL.DBF + BSHEET.DBF + CASHTAB.DBF + SALEDATA.DBF + CAPTAB.DBF + OPTABLE.DBF in legacy FoxPro system
 */
import mongoose, { Document, Schema } from 'mongoose';

// ---------- Embedded Sub-Schemas ----------

export interface IPandL {
  srev: number;        // Sales revenue
  openinv: number;     // Opening inventory value
  matrls: number;      // Material cost
  labour: number;      // Labour cost
  prodcost: number;    // Total production cost
  gafs: number;        // Goods available for sale
  closinv: number;     // Closing inventory value
  cofgs: number;       // Cost of goods sold
  gprofit: number;     // Gross profit
  sadexp: number;      // S&A expenses
  randexp: number;     // R&D expenses
  markexp: number;     // Market research expense
  bdebts: number;      // Bad debts
  sdisc: number;       // Sales discounts
  totfin: number;      // Total financial costs
  tloanint: number;    // Term loan interest
  bondint: number;     // Bond interest
  stlint: number;      // Short-term loan interest
  shkint: number;      // Shark loan interest
  miscexp: number;     // Misc expenses
  itax: number;        // Income tax
  netinc: number;      // Net income (PAT)
  eqdiv: number;       // Equity dividend
  pdiv: number;        // Preference dividend
  deprec: number;      // Depreciation
  extitem: number;     // Extraordinary items
  esprice: number;     // Share price
  psprice: number;     // Preference share price
  acp1: number;        // Avg cost price — product 1
  acp2: number;        // Avg cost price — product 2
  acp3: number;        // Avg cost price — product 3
  acp4: number;        // Avg cost price — product 4
  ttoteq: number;      // Total equity
  cumloss: number;     // Cumulative loss carry-forward
  eqtnd: number;       // Equity tender price used for this quarter's issue
}

const PandLSchema = new Schema<IPandL>(
  {
    srev: { type: Number, default: 0 },
    openinv: { type: Number, default: 0 },
    matrls: { type: Number, default: 0 },
    labour: { type: Number, default: 0 },
    prodcost: { type: Number, default: 0 },
    gafs: { type: Number, default: 0 },
    closinv: { type: Number, default: 0 },
    cofgs: { type: Number, default: 0 },
    gprofit: { type: Number, default: 0 },
    sadexp: { type: Number, default: 0 },
    randexp: { type: Number, default: 0 },
    markexp: { type: Number, default: 0 },
    bdebts: { type: Number, default: 0 },
    sdisc: { type: Number, default: 0 },
    totfin: { type: Number, default: 0 },
    tloanint: { type: Number, default: 0 },
    bondint: { type: Number, default: 0 },
    stlint: { type: Number, default: 0 },
    shkint: { type: Number, default: 0 },
    miscexp: { type: Number, default: 0 },
    itax: { type: Number, default: 0 },
    netinc: { type: Number, default: 0 },
    eqdiv: { type: Number, default: 0 },
    pdiv: { type: Number, default: 0 },
    deprec: { type: Number, default: 0 },
    extitem: { type: Number, default: 0 },
    esprice: { type: Number, default: 0 },
    psprice: { type: Number, default: 0 },
    acp1: { type: Number, default: 0 },
    acp2: { type: Number, default: 0 },
    acp3: { type: Number, default: 0 },
    acp4: { type: Number, default: 0 },
    ttoteq: { type: Number, default: 0 },
    cumloss: { type: Number, default: 0 },
    eqtnd: { type: Number, default: 0 },
  },
  { _id: false }
);

export interface IBSheet {
  eshares: number;     // Equity shares
  pshares: number;     // Preference shares
  retearn: number;     // Retained earnings
  toteq: number;       // Total equity
  totpref: number;     // Total preference capital
  esprice: number;     // Share price
  closeinv: number;    // Closing inventory
  arecble: number;     // Accounts receivable
  cashhand: number;    // Cash in hand
  plant: number;       // Plant (gross)
  macery: number;      // Machinery (gross)
  deprecp: number;     // Accumulated depreciation — plant
  deprecm: number;     // Accumulated depreciation — machinery
  totfixast: number;   // Total fixed assets (net)
  totcurast: number;   // Total current assets
  totcurlib: number;   // Total current liabilities
  netcurast: number;   // Net current assets (Working Capital)
  totlnglib: number;   // Total long-term liabilities
  totast: number;      // Total assets
  totlib: number;      // Total liabilities
  acpayble: number;    // Accounts payable
  stlpayble: number;   // Short-term loan payable
  shkpayble: number;   // Shark loan payable
  tloanmat: number;    // Term loans maturing
  bondmat: number;     // Bonds maturing
  twyloans: number;    // 2-year loans outstanding
  thyloans: number;    // 3-year loans outstanding
  bonds: number;       // Bonds outstanding
  invmnt: number;      // Investments (FD/MF)
  cratio: number;      // Current ratio
  atr: number;         // Asset turnover ratio
  de: number;          // Debt/Equity ratio
  pem: number;         // Price-Earnings multiple
  sprem: number;       // Securities premium — equity
  psprem: number;      // Securities premium — preference
}

const BSheetSchema = new Schema<IBSheet>(
  {
    eshares: { type: Number, default: 0 },
    pshares: { type: Number, default: 0 },
    retearn: { type: Number, default: 0 },
    toteq: { type: Number, default: 0 },
    totpref: { type: Number, default: 0 },
    esprice: { type: Number, default: 0 },
    closeinv: { type: Number, default: 0 },
    arecble: { type: Number, default: 0 },
    cashhand: { type: Number, default: 0 },
    plant: { type: Number, default: 0 },
    macery: { type: Number, default: 0 },
    deprecp: { type: Number, default: 0 },
    deprecm: { type: Number, default: 0 },
    totfixast: { type: Number, default: 0 },
    totcurast: { type: Number, default: 0 },
    totcurlib: { type: Number, default: 0 },
    netcurast: { type: Number, default: 0 },
    totlnglib: { type: Number, default: 0 },
    totast: { type: Number, default: 0 },
    totlib: { type: Number, default: 0 },
    acpayble: { type: Number, default: 0 },
    stlpayble: { type: Number, default: 0 },
    shkpayble: { type: Number, default: 0 },
    tloanmat: { type: Number, default: 0 },
    bondmat: { type: Number, default: 0 },
    twyloans: { type: Number, default: 0 },
    thyloans: { type: Number, default: 0 },
    bonds: { type: Number, default: 0 },
    invmnt: { type: Number, default: 0 },
    cratio: { type: Number, default: 0 },
    atr: { type: Number, default: 0 },
    de: { type: Number, default: 0 },
    pem: { type: Number, default: 0 },
    sprem: { type: Number, default: 0 },
    psprem: { type: Number, default: 0 },
  },
  { _id: false }
);

export interface ICashTab {
  opencash: number;
  endcash: number;
  scolc: number;       // Collections — current
  scolp: number;       // Collections — prior
  srevc: number;       // Cash sales revenue
  edmatc: number;      // Material payments — current
  edmatp: number;      // Material payments — prior
  edlabc: number;      // Labour payments — current
  edlabp: number;      // Labour payments — prior
  eovhc: number;       // Overhead payments — current
  eovhp: number;       // Overhead payments — prior
  esadc: number;       // S&A payment
  egdown: number;      // Warehouse/godown
  erand: number;       // R&D payment
  mrexpc: number;      // Market research — current
  mrexpp: number;      // Market research — prior
  capexp: number;      // Capital expenditure
  neweq: number;       // New equity raised
  newpref: number;     // New preference raised
  loans: number;       // New loans received
  invmnt: number;      // Investments
  invsale: number;     // Investment sale
  invint: number;      // Investment interest
  itax: number;        // Tax paid
  ediv: number;        // Equity dividends paid
  pdiv: number;        // Preference dividends paid
  sharkl: number;      // Shark loan received
  shklint: number;     // Shark loan interest
  shklrep: number;     // Shark loan repayment
  stlpp: number;       // STL principal payment
  stlint: number;      // STL interest
  tloanint: number;    // Term loan interest
  bondint: number;     // Bond interest
  cumpripay: number;   // Cumulative principal paid
  miscexp: number;     // Misc expenses
  extitem: number;     // Extraordinary items
}

const CashTabSchema = new Schema<ICashTab>(
  {
    opencash: { type: Number, default: 0 },
    endcash: { type: Number, default: 0 },
    scolc: { type: Number, default: 0 },
    scolp: { type: Number, default: 0 },
    srevc: { type: Number, default: 0 },
    edmatc: { type: Number, default: 0 },
    edmatp: { type: Number, default: 0 },
    edlabc: { type: Number, default: 0 },
    edlabp: { type: Number, default: 0 },
    eovhc: { type: Number, default: 0 },
    eovhp: { type: Number, default: 0 },
    esadc: { type: Number, default: 0 },
    egdown: { type: Number, default: 0 },
    erand: { type: Number, default: 0 },
    mrexpc: { type: Number, default: 0 },
    mrexpp: { type: Number, default: 0 },
    capexp: { type: Number, default: 0 },
    neweq: { type: Number, default: 0 },
    newpref: { type: Number, default: 0 },
    loans: { type: Number, default: 0 },
    invmnt: { type: Number, default: 0 },
    invsale: { type: Number, default: 0 },
    invint: { type: Number, default: 0 },
    itax: { type: Number, default: 0 },
    ediv: { type: Number, default: 0 },
    pdiv: { type: Number, default: 0 },
    sharkl: { type: Number, default: 0 },
    shklint: { type: Number, default: 0 },
    shklrep: { type: Number, default: 0 },
    stlpp: { type: Number, default: 0 },
    stlint: { type: Number, default: 0 },
    tloanint: { type: Number, default: 0 },
    bondint: { type: Number, default: 0 },
    cumpripay: { type: Number, default: 0 },
    miscexp: { type: Number, default: 0 },
    extitem: { type: Number, default: 0 },
  },
  { _id: false }
);

export interface ISaleData {
  prod1: number;
  prod2: number;
  prod3: number;
  prod4: number;
  sale1: number;
  sale2: number;
  sale3: number;
  sale4: number;
  closeinv1: number;
  closeinv2: number;
  closeinv3: number;
  closeinv4: number;
  crawin1: number;     // Closing RM inventory 1
  crawin2: number;     // Closing RM inventory 2
  ordbook1: number;
  ordbook2: number;
  ordbook3: number;
  ordbook4: number;
  rawx: number;        // RM1 purchases
  rawy: number;        // RM2 purchases
  wax: number;         // RM1 weighted avg cost
  way: number;         // RM2 weighted avg cost
  rawxpri: number;     // RM1 price paid
  rawypri: number;     // RM2 price paid
  matred: number;      // RM reduction from R&D
  matred1: number;
  matred2: number;
  prodcap: number;     // Production capacity used
}

const SaleDataSchema = new Schema<ISaleData>(
  {
    prod1: { type: Number, default: 0 },
    prod2: { type: Number, default: 0 },
    prod3: { type: Number, default: 0 },
    prod4: { type: Number, default: 0 },
    sale1: { type: Number, default: 0 },
    sale2: { type: Number, default: 0 },
    sale3: { type: Number, default: 0 },
    sale4: { type: Number, default: 0 },
    closeinv1: { type: Number, default: 0 },
    closeinv2: { type: Number, default: 0 },
    closeinv3: { type: Number, default: 0 },
    closeinv4: { type: Number, default: 0 },
    crawin1: { type: Number, default: 0 },
    crawin2: { type: Number, default: 0 },
    ordbook1: { type: Number, default: 0 },
    ordbook2: { type: Number, default: 0 },
    ordbook3: { type: Number, default: 0 },
    ordbook4: { type: Number, default: 0 },
    rawx: { type: Number, default: 0 },
    rawy: { type: Number, default: 0 },
    wax: { type: Number, default: 0 },
    way: { type: Number, default: 0 },
    rawxpri: { type: Number, default: 0 },
    rawypri: { type: Number, default: 0 },
    matred: { type: Number, default: 0 },
    matred1: { type: Number, default: 0 },
    matred2: { type: Number, default: 0 },
    prodcap: { type: Number, default: 0 },
  },
  { _id: false }
);

export interface ICapTab {
  maccap: number;      // Machine capacity
  placap: number;      // Plant capacity
  newmcap: number;     // New machine capacity
  newpcap: number;     // New plant capacity
  deprecm: number;     // Machine depreciation
  deprecp: number;     // Plant depreciation
  cumlabred: number;   // Cumulative labour reduction
  fsadred: number;     // Fixed S&A reduction
  vsadred: number;     // Variable S&A reduction
  ovrhdred: number;    // Overhead reduction
}

const CapTabSchema = new Schema<ICapTab>(
  {
    maccap: { type: Number, default: 0 },
    placap: { type: Number, default: 0 },
    newmcap: { type: Number, default: 0 },
    newpcap: { type: Number, default: 0 },
    deprecm: { type: Number, default: 0 },
    deprecp: { type: Number, default: 0 },
    cumlabred: { type: Number, default: 0 },
    fsadred: { type: Number, default: 0 },
    vsadred: { type: Number, default: 0 },
    ovrhdred: { type: Number, default: 0 },
  },
  { _id: false }
);

export interface IOpTable {
  dmat: number;        // Direct materials
  dlab: number;        // Direct labour
  ovh: number;         // Overhead
  godown: number;      // Warehouse/godown cost
  sadcost: number;     // S&A cost
  alabcost1: number;
  alabcost2: number;
  alabcost3: number;
  alabcost4: number;
  strikea: number;     // Strike cost A
  strikeb: number;     // Strike cost B
}

const OpTableSchema = new Schema<IOpTable>(
  {
    dmat: { type: Number, default: 0 },
    dlab: { type: Number, default: 0 },
    ovh: { type: Number, default: 0 },
    godown: { type: Number, default: 0 },
    sadcost: { type: Number, default: 0 },
    alabcost1: { type: Number, default: 0 },
    alabcost2: { type: Number, default: 0 },
    alabcost3: { type: Number, default: 0 },
    alabcost4: { type: Number, default: 0 },
    strikea: { type: Number, default: 0 },
    strikeb: { type: Number, default: 0 },
  },
  { _id: false }
);

// ---------- Root Document ----------

/** Snapshot of one active loan, embedded on QuarterOutput.loanSnapshot */
export interface ILoanSnapshotEntry {
  loanNo: number;
  lamount: number;
  intrate: number;
  duration: number;
  amountdue: number;
  emi: number;
  endsin: number;
}

const LoanSnapshotEntrySchema = new Schema<ILoanSnapshotEntry>(
  {
    loanNo: { type: Number, default: 0 },
    lamount: { type: Number, default: 0 },
    intrate: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    amountdue: { type: Number, default: 0 },
    emi: { type: Number, default: 0 },
    endsin: { type: Number, default: 0 },
  },
  { _id: false }
);

export interface IQuarterOutput {
  gameId: string;
  teamNo: number;
  quarterNo: number;
  pandl: IPandL;
  bsheet: IBSheet;
  cashtab: ICashTab;
  saledata: ISaleData;
  captab: ICapTab;
  optable: IOpTable;
  /** EventModule strike-state machine (0..5) — carried into next quarter */
  strikeState: number;
  /**
   * Snapshot of active loans at the end of this quarter. Engine reads
   * this from the PREVIOUS quarter when processing — guarantees re-runs
   * pick up the same prior-quarter state as the first run, instead of
   * the mutable LoanMaster collection which reflects the latest run.
   */
  loanSnapshot: ILoanSnapshotEntry[];
  processedAt: Date;
}

export interface IQuarterOutputDocument extends IQuarterOutput, Document {}

const QuarterOutputSchema = new Schema<IQuarterOutputDocument>(
  {
    gameId: { type: String, required: true },
    teamNo: { type: Number, required: true },
    quarterNo: { type: Number, required: true },
    pandl: { type: PandLSchema },
    bsheet: { type: BSheetSchema },
    cashtab: { type: CashTabSchema },
    saledata: { type: SaleDataSchema },
    captab: { type: CapTabSchema },
    optable: { type: OpTableSchema },
    strikeState: { type: Number, default: 0 },
    loanSnapshot: { type: [LoanSnapshotEntrySchema], default: [] },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

QuarterOutputSchema.index({ gameId: 1, teamNo: 1, quarterNo: 1 }, { unique: true });

export const QuarterOutput = mongoose.model<IQuarterOutputDocument>(
  'QuarterOutput',
  QuarterOutputSchema
);

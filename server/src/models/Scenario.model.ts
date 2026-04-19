/**
 * Scenario Model
 * Maps to: GAMEAID.DBF + PRODS.DBF (PRODSTRAI) + FORECAST.DBF in legacy FoxPro system
 */
import mongoose, { Document, Schema } from 'mongoose';

// ---------- Embedded Sub-Schemas ----------

export interface IGameAid {
  nooft: number;           // Number of teams
  bmatcostx: number;       // Base RM1 cost
  bmatcosty: number;       // Base RM2 cost
  blabcost1: number;
  blabcost2: number;
  blabcost3: number;
  blabcost4: number;
  blabslab1: number;
  blabslab2: number;
  blabslab3: number;
  bwhcost1: number;
  bwhcost2: number;
  bwhcost3: number;
  bwhslab1: number;
  bwhslab2: number;
  bovrhd1: number;
  bovrhd2: number;
  bovrhd3: number;
  bovrhsb1: number;
  bovrhsb2: number;
  mcapcost: number;        // Machine capacity cost per unit
  pcapcost: number;        // Plant capacity cost per unit
  mlife: number;           // Machine life (quarters)
  plife: number;           // Plant life (quarters)
  eqfv: number;            // Equity face value
  mincash: number;         // Minimum cash balance
  cashsale: number;        // % cash sales
  itaxrate: number;        // Income tax rate
  dtax: number;            // Deferred tax
  prefdiv: number;         // Preference dividend rate
  preffv: number;          // Preference face value
  wincrit: string;         // Default win criterion
  gametype: string;        // P=Production, S=Service
  rm11: number;            // RM1 consumption — product 1
  rm12: number;            // RM1 consumption — product 2
  rm13: number;            // RM1 consumption — product 3
  rm14: number;            // RM1 consumption — product 4
  rm21: number;            // RM2 consumption — product 1
  rm22: number;            // RM2 consumption — product 2
  rm23: number;            // RM2 consumption — product 3
  rm24: number;            // RM2 consumption — product 4
  lama11: number;          // Lambda demand factor
  lama21: number;
  lamb11: number;
  lamc11: number;
  scol1?: number;          // Credit collection % for crPrd=1 (GAMEAID.SCOL1)
  scol2?: number;          // Credit collection % for crPrd=2 (GAMEAID.SCOL2)
  vsadcost?: number;       // Variable S&A rate as fraction of gross revenue (GAMEAID.VSADCOST)
  fsadcost?: number;       // Fixed S&A base cost per quarter (GAMEAID.FSADCOST)
  matpayfrac?: number;     // Fraction of material cost paid current quarter (default 0.8)
  labpayfrac?: number;     // Fraction of labour cost paid current quarter (default 0.9)
  train1cst?: number;      // Cost of training project 1 (flows to CASHTAB.miscexp → TOTFIN)
  train2cst?: number;      // Cost of training project 2
  train3cst?: number;      // Cost of training project 3
  train4cst?: number;      // Cost of training project 4
}

const GameAidSchema = new Schema<IGameAid>(
  {
    nooft: { type: Number, default: 0 },
    bmatcostx: { type: Number, default: 0 },
    bmatcosty: { type: Number, default: 0 },
    blabcost1: { type: Number, default: 0 },
    blabcost2: { type: Number, default: 0 },
    blabcost3: { type: Number, default: 0 },
    blabcost4: { type: Number, default: 0 },
    blabslab1: { type: Number, default: 0 },
    blabslab2: { type: Number, default: 0 },
    blabslab3: { type: Number, default: 0 },
    bwhcost1: { type: Number, default: 0 },
    bwhcost2: { type: Number, default: 0 },
    bwhcost3: { type: Number, default: 0 },
    bwhslab1: { type: Number, default: 0 },
    bwhslab2: { type: Number, default: 0 },
    bovrhd1: { type: Number, default: 0 },
    bovrhd2: { type: Number, default: 0 },
    bovrhd3: { type: Number, default: 0 },
    bovrhsb1: { type: Number, default: 0 },
    bovrhsb2: { type: Number, default: 0 },
    mcapcost: { type: Number, default: 0 },
    pcapcost: { type: Number, default: 0 },
    mlife: { type: Number, default: 0 },
    plife: { type: Number, default: 0 },
    eqfv: { type: Number, default: 0 },
    mincash: { type: Number, default: 0 },
    cashsale: { type: Number, default: 0 },
    itaxrate: { type: Number, default: 0 },
    dtax: { type: Number, default: 0 },
    prefdiv: { type: Number, default: 0 },
    preffv: { type: Number, default: 0 },
    wincrit: { type: String },
    gametype: { type: String },
    rm11: { type: Number, default: 0 },
    rm12: { type: Number, default: 0 },
    rm13: { type: Number, default: 0 },
    rm14: { type: Number, default: 0 },
    rm21: { type: Number, default: 0 },
    rm22: { type: Number, default: 0 },
    rm23: { type: Number, default: 0 },
    rm24: { type: Number, default: 0 },
    lama11: { type: Number, default: 0 },
    lama21: { type: Number, default: 0 },
    lamb11: { type: Number, default: 0 },
    lamc11: { type: Number, default: 0 },
    scol1: { type: Number },
    scol2: { type: Number },
    vsadcost: { type: Number },
    fsadcost: { type: Number },
    matpayfrac: { type: Number },
    labpayfrac: { type: Number },
    train1cst: { type: Number },
    train2cst: { type: Number },
    train3cst: { type: Number },
    train4cst: { type: Number },
  },
  { _id: false }
);

export interface IProdsTraiField {
  pflexa: number[];        // Price flex A per product
  pflexb: number[];        // Price flex B per product
  pflexc: number[];        // Price flex C per product
  threslo: number[];       // Price threshold low
  threshi: number[];       // Price threshold high
  pf: number[];            // Fixed ad sensitivity
  pv: number[];            // Variable ad sensitivity
  myopicf: number[];       // Fixed ad longevity
  myopicv: number[];       // Variable ad longevity
  indpsense: number | number[];  // scalar (MPX) or per-product array (Paper/Petroleum)
  labfactor: number[];     // Labour factor per product
  spscol?: number[];       // Per-product special collection delta (PARAMS.spscol in FoxPro)
}

const ProdsTraiSchema = new Schema<IProdsTraiField>(
  {
    pflexa: { type: [Number], default: [] },
    pflexb: { type: [Number], default: [] },
    pflexc: { type: [Number], default: [] },
    threslo: { type: [Number], default: [] },
    threshi: { type: [Number], default: [] },
    pf: { type: [Number], default: [] },
    pv: { type: [Number], default: [] },
    myopicf: { type: [Number], default: [] },
    myopicv: { type: [Number], default: [] },
    indpsense: { type: mongoose.Schema.Types.Mixed, default: 1.0 },
    labfactor: { type: [Number], default: [] },
    spscol: { type: [Number], default: [] },
  },
  { _id: false }
);

export interface IForecast {
  quarterNo: number;
  trend1: number;
  trend2: number;
  trend3: number;
  trend4: number;
  si1: number;             // Seasonal index
  si2: number;
  si3: number;
  si4: number;
  ci: number;              // Cyclical index
  sensex: number;
  wpi: number;
  gdp: number;
  mindex: number;
  intrate: number;
  geneco: number;
  fcasta1: number;
  fcasta2: number;
  fcasta3: number;
  fcasta4: number;
  demand1: number;
  demand2: number;
  demand3: number;
  demand4: number;
  matcostch1: number;
  matcostch2: number;
  labcostch: number;
  conquant1: number;
  conquant2: number;
  conquant3: number;
  conquant4: number;
  expoinc1: number;
  expoinc2: number;
  expoinc3: number;
  expoinc4: number;
  cscolp1: number;
  cscolp2: number;
  cscolp3: number;
  cscolp4: number;
  rm1lim: number;
  rm2lim: number;
  shipqrt: number;
  odsqueze: number;
  riskp: number;
  deltax: number;
  dtaxch: number;
  delwh: number;
  mcost: number;
  pcost: number;
  procpri1: number;
  procpri2: number;
  procpri3: number;
  procpri4: number;
  blkrm1: number;
  blkrm2: number;
  /** Variable S&A as a percentage of gross revenue (FORECAST.VARSAD). */
  varsad?: number;
}

const ForecastSchema = new Schema<IForecast>(
  {
    quarterNo: { type: Number, required: true },
    trend1: { type: Number, default: 0 },
    trend2: { type: Number, default: 0 },
    trend3: { type: Number, default: 0 },
    trend4: { type: Number, default: 0 },
    si1: { type: Number, default: 0 },
    si2: { type: Number, default: 0 },
    si3: { type: Number, default: 0 },
    si4: { type: Number, default: 0 },
    ci: { type: Number, default: 0 },
    sensex: { type: Number, default: 0 },
    wpi: { type: Number, default: 0 },
    gdp: { type: Number, default: 0 },
    mindex: { type: Number, default: 0 },
    intrate: { type: Number, default: 0 },
    geneco: { type: Number, default: 0 },
    fcasta1: { type: Number, default: 0 },
    fcasta2: { type: Number, default: 0 },
    fcasta3: { type: Number, default: 0 },
    fcasta4: { type: Number, default: 0 },
    demand1: { type: Number, default: 0 },
    demand2: { type: Number, default: 0 },
    demand3: { type: Number, default: 0 },
    demand4: { type: Number, default: 0 },
    matcostch1: { type: Number, default: 0 },
    matcostch2: { type: Number, default: 0 },
    labcostch: { type: Number, default: 0 },
    conquant1: { type: Number, default: 0 },
    conquant2: { type: Number, default: 0 },
    conquant3: { type: Number, default: 0 },
    conquant4: { type: Number, default: 0 },
    expoinc1: { type: Number, default: 0 },
    expoinc2: { type: Number, default: 0 },
    expoinc3: { type: Number, default: 0 },
    expoinc4: { type: Number, default: 0 },
    cscolp1: { type: Number, default: 0 },
    cscolp2: { type: Number, default: 0 },
    cscolp3: { type: Number, default: 0 },
    cscolp4: { type: Number, default: 0 },
    rm1lim: { type: Number, default: 0 },
    rm2lim: { type: Number, default: 0 },
    shipqrt: { type: Number, default: 0 },
    odsqueze: { type: Number, default: 0 },
    riskp: { type: Number, default: 0 },
    deltax: { type: Number, default: 0 },
    dtaxch: { type: Number, default: 0 },
    delwh: { type: Number, default: 0 },
    mcost: { type: Number, default: 0 },
    pcost: { type: Number, default: 0 },
    procpri1: { type: Number, default: 0 },
    procpri2: { type: Number, default: 0 },
    procpri3: { type: Number, default: 0 },
    procpri4: { type: Number, default: 0 },
    blkrm1: { type: Number, default: 0 },
    blkrm2: { type: Number, default: 0 },
    varsad: { type: Number, default: 0 },
  },
  { _id: false }
);

// ---------- Root Document ----------

export interface IScenario {
  name: string;
  description: string;
  gameType: 'P' | 'S';
  productNames: string[];
  rm1Name: string;
  rm2Name: string;
  gameaid: IGameAid;
  prodstrai: IProdsTraiField;
  forecast: IForecast[];
}

export interface IScenarioDocument extends IScenario, Document {}

const ScenarioSchema = new Schema<IScenarioDocument>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    gameType: { type: String, enum: ['P', 'S'], default: 'P' },
    productNames: { type: [String], default: [] },
    rm1Name: { type: String },
    rm2Name: { type: String },
    gameaid: { type: GameAidSchema },
    prodstrai: { type: ProdsTraiSchema },
    forecast: { type: [ForecastSchema], default: [] },
  },
  { timestamps: true }
);

export const Scenario = mongoose.model<IScenarioDocument>('Scenario', ScenarioSchema);

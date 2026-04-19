/**
 * Engine Type Definitions — All interfaces used by the simulation engine.
 *
 * These types mirror the legacy DBF table structures and FoxPro variable
 * layouts. Field names are kept lowercase to match the original DBF columns
 * for traceability (per CLAUDE.md Section 4 rule).
 */

// ═══════════════════════════════════════════════════════════════════
// CONFIG / SCENARIO INTERFACES
// ═══════════════════════════════════════════════════════════════════

/** Maps to GAMEAID.DBF — per-game configuration set by facilitator */
export interface GameAidConfig {
  gameid: string;
  nooft: number;          // Number of teams
  bmatcostx: number;      // RM1 base cost
  bmatcosty: number;      // RM2 base cost
  blabcost1: number; blabcost2: number; blabcost3: number; blabcost4: number;
  blabslab1: number; blabslab2: number; blabslab3: number;
  bwhcost1: number; bwhcost2: number; bwhcost3: number;
  bwhslab1: number; bwhslab2: number;
  bovrhd1: number; bovrhd2: number; bovrhd3: number;
  bovrhsb1: number; bovrhsb2: number;
  mcapcost: number; pcapcost: number;       // Machine / plant cost per unit capacity
  mlife: number; plife: number;             // Machine / plant life in quarters
  eqfv: number;           // Equity face value
  mincash: number;        // Minimum cash balance (triggers shark loan)
  cashsale: number;       // Cash sales percentage
  itaxrate: number;       // Income tax rate
  dtax: number;           // Deferred tax
  prefdiv: number;        // Preference dividend rate
  preffv: number;         // Preference share face value
  wincrit: string;        // Default win criterion code (M/N/P/E/V/A/B/C/O)
  gametype: string;       // 'P' = Production, 'S' = Service
  /** Strike-warning trigger probability (%) — used by EventModule */
  strikea1o?: number;
  /** Go-slow trigger probability (%) — reserved for future use */
  strikeb1o?: number;
  // RM consumption per unit of each product (RM1)
  rm11: number; rm12: number; rm13: number; rm14: number;
  // RM consumption per unit of each product (RM2)
  rm21: number; rm22: number; rm23: number; rm24: number;
  // Lambda demand factors
  lama11: number; lama21: number; lamb11: number; lamc11: number;
  /**
   * Credit collection rates (legacy GAMEAID.SCOL1 / SCOL2) expressed as
   * percent points. scol1 applies to the default credit track, scol2 is
   * used when DTABLE.CRPRD=2. Consumed by CashFlowModule's per-product
   * collection calculation once Fix 1 lands.
   */
  scol1?: number;
  scol2?: number;
  /**
   * Fixed S&A base cost per quarter (GAMEAID.FSADCOST).
   * Added to team S&A decisions before the variable component.
   * Used by Paper and other scenarios with a game-level fixed S&A floor.
   */
  fsadcost?: number;
  /**
   * Variable S&A rate as a fraction of gross revenue (GAMEAID.VSADCOST).
   * Applies when FORECAST.varsad is absent or zero.
   * Paper: 0.06 (6%). Falls back to forecast.varsad if both present.
   */
  vsadcost?: number;
  /**
   * Fraction of material cost paid in the current quarter (default 0.8 for MPX).
   * Paper: 1.0 (100% immediate payment → acpayble = 0).
   */
  matpayfrac?: number;
  /**
   * Fraction of labour cost paid in the current quarter (default 0.9 for MPX).
   * Paper: 1.0 (100% immediate payment → acpayble = 0).
   */
  labpayfrac?: number;
  /**
   * Training type 1 cost (GAMEAID.TRAIN1CST). Added to miscexp → TOTFIN when
   * a team's DTABLE.TRAIN1 = 1 (n6pro.PRG lines 263-271).
   */
  train1cst?: number;
}

/** Maps to FORECAST.DBF — per-quarter economic/market parameters */
export interface ForecastParams {
  quarterNo: number;
  // Trend indices per product
  trend1: number; trend2: number; trend3: number; trend4: number;
  // Seasonal indices per product
  si1: number; si2: number; si3: number; si4: number;
  ci: number;             // Cyclical index
  sensex: number;         // Stock market index
  wpi: number;            // Wholesale price index
  gdp: number;            // GDP indicator
  mindex: number;         // Market index
  intrate: number;        // Base interest rate (CIBOR/PLR)
  geneco: number;         // General economic indicator (-5 to +5)
  // Forecast demand adjustments
  fcasta1: number; fcasta2: number; fcasta3: number; fcasta4: number;
  // Base industry demand per product
  demand1: number; demand2: number; demand3: number; demand4: number;
  // Cost changes
  matcostch1: number; matcostch2: number; // RM cost change %
  labcostch: number;       // Labour cost change %
  // Contract quantities per product
  conquant1: number; conquant2: number; conquant3: number; conquant4: number;
  // Export incentive per product
  expoinc1: number; expoinc2: number; expoinc3: number; expoinc4: number;
  // Credit/collection policy per product
  cscolp1: number; cscolp2: number; cscolp3: number; cscolp4: number;
  // Raw material purchase limits (% deviation allowed)
  rm1lim: number; rm2lim: number;
  // Miscellaneous quarter parameters
  shipqrt: number;        // Shipping/logistics factor
  odsqueze: number;       // Overdraft squeeze factor
  riskp: number;          // Risk premium
  deltax: number;         // Tax change
  dtaxch: number;         // Deferred tax change
  delwh: number;          // Warehouse cost change
  mcost: number;          // Machine cost override
  pcost: number;          // Plant cost override
  // Procurement prices for contract products
  procpri1: number; procpri2: number; procpri3: number; procpri4: number;
  // Bulk RM purchase thresholds
  blkrm1: number; blkrm2: number;
  /** Admin-entered extraordinary item (positive = gain, negative = loss) */
  extitem?: number;
  /**
   * Variable S&A percentage (FORECAST.VARSAD). Applied by CostModule as
   * `revenue × varsad / 100` and added to the fixed S&A from DTABLE.
   */
  varsad?: number;
}

/** Maps to PRODS — demand model parameters per product */
export interface ProdsConfig {
  /** Price flexibility coefficients (array indexed by product 0..3) */
  pflexa: number[]; pflexb: number[]; pflexc: number[];
  /** Price sensitivity thresholds — low and high (per product) */
  threslo: number[]; threshi: number[];
  /** Fixed advertising sensitivity (per product) */
  pf: number[];
  /** Variable advertising sensitivity (per product) */
  pv: number[];
  /** Myopic (carry-over) factor for fixed advertising */
  myopicf: number[];
  /** Myopic (carry-over) factor for variable advertising */
  myopicv: number[];
  /**
   * Industry-wide price sensitivity exponent.
   * scalar = same sensitivity for all products (MPX: 1.0)
   * array  = per-product sensitivity (Paper: [0.01,0.25,5.0,0.1], Petroleum)
   */
  indpsense: number | number[];
  /** Labour factor per product */
  labfactor: number[];
  /** Per-product special collection delta over cashsale base (PARAMS.spscol in FoxPro) */
  spscol?: number[];
}

/** Get indpsense for a specific product index (0-based). Falls back to first element or 1.0. */
export function getIndpsense(indpsense: number | number[], productIndex: number): number {
  if (Array.isArray(indpsense)) {
    return indpsense[productIndex] ?? indpsense[0] ?? 1.0;
  }
  return indpsense;
}

// ═══════════════════════════════════════════════════════════════════
// TEAM DECISION INTERFACE
// ═══════════════════════════════════════════════════════════════════

/** Maps to DTABLE.DBF — one row per team per quarter */
export interface TeamDecision {
  teamNo: number;
  // Production quantities
  prod1: number; prod2: number; prod3: number; prod4: number;
  // Selling prices
  price1: number; price2: number; price3: number; price4: number;
  // Raw material purchases
  raw1: number; raw2: number;
  // Fixed S&A spend per product
  fsad1: number; fsad2: number; fsad3: number; fsad4: number;
  // Variable S&A spend per product
  vsad1: number; vsad2: number; vsad3: number; vsad4: number;
  // Cash discount rates per product
  dscnt1: number; dscnt2: number; dscnt3: number; dscnt4: number;
  // Capacity investments
  newPCap: number;        // New plant capacity
  newMCap: number;        // New machine capacity
  // Finance decisions
  stl: number;            // Short-term loan
  ntwLoan: number;        // 2-year term loan
  nthLoan: number;        // 3-year term loan
  nBond: number;          // New bonds
  equDiv: number;         // Equity dividend
  equNo: number;          // Equity shares to issue
  equPri: number;         // Equity issue price
  // R&D spend
  rand1: number;          // R&D Type 1
  rand2: number;          // R&D Type 2
  // Contracts / alliances
  crPrd: number;          // Contract product
  alliance1: number; alliance2: number; alliance3: number; alliance4: number;
  cprod1: number; cprod2: number; cprod3: number; cprod4: number;     // Contract production
  cprice1: number; cprice2: number; cprice3: number; cprice4: number; // Contract prices
  // Other
  strset: number;         // Strike settlement code
  bdisc: number;          // Bills discounting
  train1: number; train2: number; train3: number; train4: number;     // Training spend
  prefNo: number;         // Preference shares to issue
  prefPri: number;        // Preference issue price
}

// ═══════════════════════════════════════════════════════════════════
// STATE INTERFACES (per-team, per-quarter outputs)
// ═══════════════════════════════════════════════════════════════════

/** Maps to CAPTAB — capacity state for a team in a quarter */
export interface CapacityState {
  teamNo: number;
  maccap: number;         // Machine capacity (total usable)
  placap: number;         // Plant capacity (total usable)
  newmcap: number;        // New machine capacity added this quarter
  newpcap: number;        // New plant capacity added this quarter
  /**
   * Period (this-quarter) machine depreciation. Legacy CAPTAB semantic.
   * Use cumdeprecm for the cumulative balance that flows into BSHEET.
   */
  deprecm: number;
  /** Period (this-quarter) plant depreciation. */
  deprecp: number;
  /** Cumulative machine depreciation (for BSHEET). */
  cumdeprecm?: number;
  /** Cumulative plant depreciation (for BSHEET). */
  cumdeprecp?: number;
}

/** Maps to SALEDATA — sales, production, and inventory for a team */
export interface SaleState {
  teamNo: number;
  // Production (actual units produced)
  prod1: number; prod2: number; prod3: number; prod4: number;
  // Sales (actual units sold)
  sale1: number; sale2: number; sale3: number; sale4: number;
  // Closing FG inventory per product
  closeinv1: number; closeinv2: number; closeinv3: number; closeinv4: number;
  // Closing RM inventory
  crawin1: number; crawin2: number;
  // Order book (demand allocated to this team)
  ordbook1: number; ordbook2: number; ordbook3: number; ordbook4: number;
  // RM purchases
  rawx: number; rawy: number;
  // RM weighted average cost
  wax: number; way: number;
  // Average cost price per product (ACP method)
  acp1: number; acp2: number; acp3: number; acp4: number;
}

/** Maps to PANDL + BSHEET + CASHTAB — full financial state for a team */
export interface FinancialState {
  teamNo: number;

  // ── P&L ──
  srev: number;           // Sales revenue
  gprofit: number;        // Gross profit
  netinc: number;         // Net income (PAT)
  sadexp: number;         // S&A expenses
  randexp: number;        // R&D expenses
  bdebts: number;         // Bad debts
  totfin: number;         // Total financial costs
  itax: number;           // Income tax
  eqdiv: number;          // Equity dividend paid
  pdiv: number;           // Preference dividend paid
  deprec: number;         // Total depreciation
  extitem: number;        // Extraordinary items
  cumloss: number;        // Cumulative loss carry-forward

  // ── Balance Sheet ──
  toteq: number;          // Total equity capital
  totpref: number;        // Total preference capital
  retearn: number;        // Retained earnings
  eshares: number;        // Equity shares outstanding
  pshares: number;        // Preference shares outstanding
  esprice: number;        // Share price
  totfixast: number;      // Total fixed assets (net)
  totcurast: number;      // Total current assets
  totcurlib: number;      // Total current liabilities
  totlnglib: number;      // Total long-term liabilities
  totast: number;         // Total assets
  /** Total liabilities (totcurlib + totlnglib) — newly added, optional for legacy callers */
  totlib?: number;
  cashhand: number;       // Cash in hand
  arecble: number;        // Accounts receivable
  closeinv: number;       // Closing inventory (FG + RM value)
  cratio: number;         // Current ratio
  de: number;             // Debt / Equity ratio
  atr: number;            // Asset turnover ratio

  /**
   * Equity tender price (PANDL.EQTND in legacy). Stored each quarter and
   * consumed NEXT quarter as the issue price when equNo > 0. Seeded at Q0
   * with the empirical MPA-iipm Q1 value so Q1 round-trips. Optional so
   * prior-quarter records that predate this field still load.
   */
  eqtnd?: number;
  /** Securities premium from this quarter's equity issue (eshares × (spf − eqfv)) */
  sprem?: number;
  /** Preference securities premium (0 unless preference issued above face) */
  psprem?: number;

  // ── Cash ──
  opencash: number;       // Opening cash balance
  endcash: number;        // Ending cash balance
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE I/O — Top-level orchestrator contracts
// ═══════════════════════════════════════════════════════════════════

/** Input bundle for a full quarter processing run */
export interface QuarterEngineInput {
  gameId: string;
  quarterNo: number;
  gameaid: GameAidConfig;
  forecast: ForecastParams;
  prods: ProdsConfig;
  allDecisions: TeamDecision[];           // All teams' decisions
  prevSaleStates: SaleState[];            // Previous quarter sales/inventory
  prevFinancialStates: FinancialState[];  // Previous quarter financials
  prevCapacityStates: CapacityState[];    // Previous quarter capacities
  /**
   * Active loans carried over from prior quarters, keyed by teamNo.
   * Each team gets the list of its outstanding LoanEntry records from
   * LoanMaster. Omit or pass {} for a fresh game at Q1.
   */
  existingLoans?: Record<number, LoanEntry[]>;
  /**
   * Strike state machine value (0..5) per team carried from the prior
   * quarter. Omit or pass {} to treat every team as state 0 (normal).
   */
  prevStrikeStates?: Record<number, number>;
}

/** Output bundle from a full quarter processing run */
export interface QuarterEngineOutput {
  gameId: string;
  quarterNo: number;
  teamOutputs: {
    teamNo: number;
    saledata: SaleState;
    financials: FinancialState;
    capacity: CapacityState;
    /** Final loan state for this team (carried into next quarter) */
    loans: LoanModuleOutput;
    /** Strike-state machine value (0..5) after EventModule ran */
    strikeState: number;
    // ── Module outputs kept on the envelope so the persistence layer can
    // write them to PANDL / CASHTAB / OPTABLE without re-running modules.
    costs: CostTeamResult;
    cashFlow: CashFlowModuleOutput;
    production: ProductionTeamResult;
    event: EventModuleOutput;
    pandlDetail: PandlDetail;
  }[];
  processedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════
// MODULE-SPECIFIC I/O INTERFACES
// ═══════════════════════════════════════════════════════════════════

// ── Capacity Module ──

export interface CapacityModuleInput {
  teamNo: number;
  decision: TeamDecision;
  prevCapacity: CapacityState;
  gameaid: GameAidConfig;
}

export interface CapacityModuleOutput {
  capacity: CapacityState;
}

// ── Demand Module ──

export interface DemandModuleInput {
  allDecisions: TeamDecision[];
  prevSaleStates: SaleState[];
  forecast: ForecastParams;
  prods: ProdsConfig;
  gameaid: GameAidConfig;
}

export interface DemandModuleOutput {
  /** Order book per team (indexed by teamNo) */
  orderBooks: {
    teamNo: number;
    ordbook1: number; ordbook2: number; ordbook3: number; ordbook4: number;
  }[];
  /** Market share per team per product */
  marketShares: {
    teamNo: number;
    share1: number; share2: number; share3: number; share4: number;
  }[];
}

// ── Production Module (batch — processes all teams) ──

export interface ProductionModuleInput {
  decisions: TeamDecision[];
  demandOutput: DemandModuleOutput;
  capacityStates: CapacityState[];
  prevSaleStates: SaleState[];
  forecast: ForecastParams;
  gameaid: GameAidConfig;
}

/** Per-team production result */
export interface ProductionTeamResult {
  teamNo: number;
  finalProd: [number, number, number, number];
  actualSales: [number, number, number, number];
  closingFG: [number, number, number, number];
  /**
   * Own-produced closing FG only (excludes outsourced units).
   * Used for P&L closeFGvalue — outsourced units are expensed via cash, not inventory.
   */
  ownClosingFG: [number, number, number, number];
  openFG: [number, number, number, number];
  outsourced: [number, number, number, number];
  rmPurchased: [number, number];
  rmConsumed: [number, number];
  closingRM: [number, number];
  wax: number;
  way: number;
  currentRM1Price: number;
  currentRM2Price: number;
  usableCap: number;
}

/** Array of per-team production results */
export type ProductionModuleOutput = ProductionTeamResult[];

// ── Cost Module (batch — processes all teams) ──

export interface CostModuleInput {
  productionOutputs: ProductionTeamResult[];
  decisions: TeamDecision[];
  capacityStates: CapacityState[];
  prevSaleStates: SaleState[];
  prevFinancialStates: FinancialState[];
  gameaid: GameAidConfig;
  forecast: ForecastParams;
}

/** Per-team cost result */
export interface CostTeamResult {
  teamNo: number;
  materialCost: number;
  outsourceCost: number;
  laborCost: number;
  warehouseCost: number;
  overheadCost: number;
  totalSAD: number;
  rndExpense: number;
  productionCost: number;
  acp: [number, number, number, number];
  costPerUnit: number;
}

/** Array of per-team cost results */
export type CostModuleOutput = CostTeamResult[];

// ── Contract Module ──

export interface ContractModuleInput {
  allDecisions: TeamDecision[];
  forecast: ForecastParams;
  gameaid: GameAidConfig;
}

/** Per-team allocation for a single product contract */
export interface ContractAllocation {
  teamNo: number;
  quantity: number;
  revenue: number;
}

/** Contract outcome for a single product */
export interface ProductContract {
  /** 1..4 */
  productIndex: number;
  /** Total contract quantity available (from forecast.conquant*) */
  contractQty: number;
  /** Winning alliance code (0 if no winner) */
  winningAlliance: number;
  /** Weighted average bid price of the winning alliance */
  winningPrice: number;
  /** Per-member allocations within the winning alliance */
  allocations: ContractAllocation[];
  /** True when no valid bids were submitted for this product */
  noWinner: boolean;
}

/** Per-team rollup of contract units/revenue across products 1..4 */
export interface TeamContractAllocation {
  contractUnits: [number, number, number, number];
  contractRevenue: [number, number, number, number];
  totalContractRevenue: number;
}

export interface ContractModuleOutput {
  /** One entry per product (1..4) */
  productContracts: ProductContract[];
  /** Per-team rollup, keyed by teamNo */
  teamAllocations: Record<number, TeamContractAllocation>;
}

// ── Cash Flow Module ──

export interface CashFlowModuleInput {
  teamNo: number;
  decision: TeamDecision;
  production: ProductionTeamResult;
  costs: CostTeamResult;
  orderBook: { ordbook1: number; ordbook2: number; ordbook3: number; ordbook4: number };
  contractQuantities: { cqty1: number; cqty2: number; cqty3: number; cqty4: number };
  prevFinancials: FinancialState;
  prevSaleState: SaleState;
  capacity: CapacityState;
  gameaid: GameAidConfig;
  forecast: ForecastParams;
  prods?: ProdsConfig;
}

export interface CashFlowModuleOutput {
  /** Actual sales per product */
  sale1: number; sale2: number; sale3: number; sale4: number;
  /** Revenue */
  srev: number;
  /** Cash flow statement fields (maps to CASHTAB) */
  opencash: number; endcash: number;
  scolc: number; scolp: number; srevc: number;
  edmatc: number; edmatp: number;
  edlabc: number; edlabp: number;
  eovhc: number; eovhp: number;
  esadc: number; egdown: number;
  erand: number;
  capexp: number;
  neweq: number; newpref: number;
  loans: number;
  itax: number;
  ediv: number; pdiv: number;
  /** Bad debts */
  bdebts: number;
  /** Closing accounts receivable after this quarter's collections. */
  closingAR?: number;
  /** Training / miscellaneous expense (cash outflow matching CASHTAB.MISCEXP) */
  miscexp?: number;
}

// ── Financial Module ──

export interface FinancialModuleInput {
  teamNo: number;
  decision: TeamDecision;
  cashFlow: CashFlowModuleOutput;
  production: ProductionTeamResult;
  costs: CostTeamResult;
  capacity: CapacityState;
  prevCapacity: CapacityState;          // Previous quarter capacity (for depreciation delta)
  prevFinancials: FinancialState;
  prevSaleState: SaleState;
  gameaid: GameAidConfig;
  forecast: ForecastParams;
  loans: LoanModuleOutput;              // Loan processing results (interest costs for P&L)
}

/**
 * P&L line-item detail that `FinancialState` does not track (because those
 * aggregates like gprofit/netinc are what the next quarter actually needs as
 * opening state). Persistence and reporting require the raw breakdown, so
 * FinancialModule surfaces them alongside the assembled FinancialState.
 */
export interface PandlDetail {
  /** Opening FG inventory VALUE (Σ openFG × prev ACP) */
  openinv: number;
  /** Closing FG inventory VALUE (Σ closingFG × current ACP) — FG only, not FG+RM */
  closinvFG: number;
  /** Direct material cost (from CostModule) */
  matrls: number;
  /** Direct labour cost (from CostModule) */
  labour: number;
  /** Warehouse / godown cost (from CostModule) */
  whose: number;
  /** Production overhead (from CostModule) */
  othovh: number;
  /** Production cost total = matrls + labour + whose + othovh */
  prodcost: number;
  /** Total direct cost = matrls + labour */
  totdircst: number;
  /** COGS = openinv + prodcost − closinvFG */
  cofgs: number;
  /** Misc / unmodelled expense bucket (0 for now) */
  miscexp: number;
}

export interface FinancialModuleOutput {
  financials: FinancialState;
  /** ACP per product for this quarter */
  acp1: number; acp2: number; acp3: number; acp4: number;
  /** Raw P&L line items not carried on FinancialState */
  pandlDetail: PandlDetail;
}

// ── Loan Module ──

export interface LoanEntry {
  loanNo: number;
  lamount: number;        // Original principal
  intrate: number;        // Quarterly interest rate
  duration: number;       // Total quarters
  amountdue: number;      // Outstanding balance
  emi: number;            // Equated quarterly instalment
  endsin: number;         // Quarters remaining
}

export interface LoanModuleInput {
  teamNo: number;
  decision: TeamDecision;
  existingLoans: LoanEntry[];
  financials: FinancialState;
  gameaid: GameAidConfig;
  forecast: ForecastParams;
}

export interface LoanModuleOutput {
  updatedLoans: LoanEntry[];
  totalInterest: number;
  totalEMI: number;
  /** Shark loan details (auto-triggered if endcash < minCash) */
  sharkLoan: number;
  sharkInterest: number;
}

// ── Valuation Module ──

export interface ValuationModuleInput {
  teamNo: number;
  financials: FinancialState;
  decision: TeamDecision;
  gameaid: GameAidConfig;
  forecast: ForecastParams;
  /** Industry-wide averages needed for P/E and DCF */
  industryAvgPE: number;
  industryAvgEPS: number;
}

export interface ValuationModuleOutput {
  esprice: number;        // Share price
  marketCap: number;      // Market capitalisation
  eps: number;            // Earnings per share
  bookValuePerShare: number;
}

// ── Event Module ──

export interface EventModuleInput {
  teamNo: number;
  quarterNo: number;
  decision: TeamDecision;
  prevStrikeState: number;      // 0–5 state machine
  /** Previous quarter's total production — used to size the wage-hike cost */
  prevTotalProduction?: number;
  forecast: ForecastParams;
  gameaid: GameAidConfig;
  /** Optional seeded random (0..1) for reproducible strike triggers */
  randomFactor?: number;
}

export interface EventModuleOutput {
  teamNo: number;
  prevStrikeState: number;
  newStrikeState: number;
  strikeMessage: string;
  /** Rs per unit wage hike applied this quarter */
  wageHike: number;
  /** wageHike × totalProduction — added to labour cost */
  additionalLaborCost: number;
  /** Multiplier on production (1.0 normal, 0.80 go-slow, 0.0 strike) */
  productionFactor: number;
  /** True while strike state === 4 */
  isOnStrike: boolean;
  extraordinaryAmount: number;
  exportIncentive: number;
  /** STRIKEA / STRIKEB cost buckets surfaced to OPTABLE */
  strikeCostA: number;
  strikeCostB: number;
}

/**
 * ENGINE_CONSTANTS — Hardcoded values from the legacy FoxPro engine.
 *
 * These values are NOT configurable per-game. They are baked into the
 * FoxPro source code (n6pro.PRG, n5pro.PRG, AREPAY.PRG, marktest.prg)
 * and must be reproduced exactly in the TypeScript engine.
 *
 * Source mapping is annotated per constant group.
 */
export const ENGINE_CONSTANTS = {
  // ─── R&D Material Reduction ──────────────────────────────────────
  // Source: n6pro.PRG — R&D processing section
  // Formula: materialReduction = (randSpend / RND_DIVISOR) ^ RND_POWER
  /** Exponent applied to normalised R&D spend to compute material-cost reduction */
  RND_POWER: 0.27,
  /** Divisor that normalises raw R&D spend before the power function */
  RND_DIVISOR: 350,

  // ─── Brand Image Component Weights ───────────────────────────────
  // Source: n6pro.PRG / marktest.prg — IMAGE calculation
  // IMAGE = 0.20×R&D + 0.30×FixedSA + 0.20×VarSA + 0.10×Projects + 0.20×VendorQuality
  IMAGE_WEIGHTS: {
    rnd: 0.20,
    fixedSA: 0.30,
    varSA: 0.20,
    projects: 0.10,
    vendorQuality: 0.20,
  },

  // ─── Share Price Model Weights ───────────────────────────────────
  // Source: n5pro.PRG — share price section
  // ESPRICE = 0.50×sp1 + 0.03×sp2 + 0.01×sp3 + 0.01×sp4 + 0.40×sp5
  SHARE_PRICE_WEIGHTS: {
    /** sp1 — Book Value per share */
    bookValue: 0.50,
    /** sp2 — P/E method (industry avg P/E × EPS) */
    pem: 0.03,
    /** sp3 — DCF method (discounted future earnings) */
    dcf: 0.01,
    /** sp4 — Gordon DDM (dividend discount model) */
    ddm: 0.01,
    /** sp5 — EVA method: (NOPAT/WACC + TaxShield×Debt − Debt) / NumShares */
    eva: 0.40,
  },

  // ─── WACC ────────────────────────────────────────────────────────
  // Source: n5pro.PRG — WACC is hardcoded quarterly
  /** Weighted average cost of capital (quarterly, not annualised) */
  WACC: 0.04,

  // ─── Bad Debts ───────────────────────────────────────────────────
  // Source: n6pro.PRG — bad-debts formula
  // badDebts = revenue × (BAD_DEBT_BASE − GENECO) / BAD_DEBT_DIVISOR
  /** Numerator base for the bad-debts formula */
  BAD_DEBT_BASE: 5,
  /** Divisor for the bad-debts formula */
  BAD_DEBT_DIVISOR: 400,

  // ─── Strike / Go-Slow Wage Hike Amounts ──────────────────────────
  // Source: n5pro.PRG — strike event section
  // Indexed by settlement state (0 = normal, 1–4 = escalating hike)
  /** Rs per unit wage hike at each strike settlement state */
  STRIKE_WAGE_HIKE: [0, 6, 10, 15, 18] as const,

  // ─── Interest Rate Risk Premiums (GETINT function) ───────────────
  // Source: AREPAY.PRG — GETINT() function
  // rate = CIBOR + liquidity_premium + current_ratio_risk + DE_risk
  //        + tenure_premium + volatility_premium + depreciation_premium

  /** Liquidity premium bands — based on loan amount */
  LIQUIDITY_PREMIUM_BANDS: [
    { limit: 100_000, premium: 0.75 },
    { limit: 500_000, premium: 0.50 },
    { limit: 1_000_000, premium: 0.40 },
    { limit: Infinity, premium: 0.30 },
  ] as const,

  /** Current ratio risk bands — lower ratio → higher risk premium */
  CURRENT_RATIO_RISK_BANDS: [
    { limit: 0.99, risk: 2.00 },
    { limit: 1.249, risk: 1.75 },
    { limit: 1.499, risk: 1.50 },
    { limit: Infinity, risk: 1.25 },
  ] as const,

  /** Debt/Equity ratio risk bands — 8 bands from 0.35 to 1.50 */
  // Source: AREPAY.PRG — exact band boundaries to be extracted from FoxPro
  // TODO: Extract exact 8 D/E band values from AREPAY.PRG
  DE_RISK_BANDS: [
    { limit: 0.50, risk: 0.35 },
    { limit: 1.00, risk: 0.50 },
    { limit: 1.50, risk: 0.65 },
    { limit: 2.00, risk: 0.80 },
    { limit: 2.50, risk: 1.00 },
    { limit: 3.00, risk: 1.15 },
    { limit: 3.50, risk: 1.30 },
    { limit: Infinity, risk: 1.50 },
  ] as const,

  // ─── Advertising Thresholds ──────────────────────────────────────
  // Source: marktest.prg — advertising effectiveness caps
  /** Below this ratio (ad_spend / benchmark), advertising has diminishing returns */
  AD_THRESHOLD_LOW: 0.70,
  /** Above this ratio, advertising saturates (no further benefit) */
  AD_THRESHOLD_HIGH: 0.97,

  // ─── Capacity ────────────────────────────────────────────────────
  // Source: n6pro.PRG — CAPHED processing section
  /** Multiplier for shift-based capacity (single shift = 1.0) */
  SHIFT_FACTOR: 1.0,
  /** Initial capacity utilisation rate for new investments */
  START_CAPACITY_UTILIZATION: 0.50,

  // ─── Service Game ────────────────────────────────────────────────
  // Source: n6pro.PRG — service game variant (gametype = 'S')
  /** Scaling factor applied in service-game scenarios (Hotel, BPO) */
  SERVICE_GAME_FACTOR: 90,

  // ─── Shark Loan ──────────────────────────────────────────────────
  // Source: n5pro.PRG — auto-triggered when endcash < minCash
  /** Shark loan interest multiplier relative to CIBOR */
  SHARK_LOAN_RATE_MULTIPLIER: 4,

  // ─── Depreciation Rates (per quarter, straight-line) ─────────────
  // Source: n6pro.PRG — CAPHED depreciation
  /** Plant depreciation rate per quarter (5%) */
  PLANT_DEPRECIATION_RATE: 0.05,
  /** Machine depreciation rate per quarter (12.5%) */
  MACHINE_DEPRECIATION_RATE: 0.125,

  // ─── Dividend Reserve Transfer ───────────────────────────────────
  // Source: n5pro.PRG — dividend constraint section
  /** Minimum reserve transfer as percentage of net income (2.5%–10%) */
  DIVIDEND_RESERVE_MIN: 0.025,
  DIVIDEND_RESERVE_MAX: 0.10,
} as const;

export type EngineConstants = typeof ENGINE_CONSTANTS;

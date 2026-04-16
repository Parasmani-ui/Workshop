/**
 * ValuationModule — STEP 9 of quarter processing pipeline.
 *
 * Computes share price using a 5-factor weighted model, market
 * capitalisation, EPS, and book value per share.
 *
 * **FoxPro Source:** `n5pro.PRG` — share price section
 *
 * @module engine/ValuationModule
 */

import { ENGINE_CONSTANTS } from './constants';
import type { ValuationModuleInput, ValuationModuleOutput } from './types';

/** Default cost of equity (annual) when not specified in game config */
const DEFAULT_COST_OF_EQUITY = 0.15;

/** Default sustainable growth rate assumption for Gordon DDM */
const DEFAULT_GROWTH_RATE = 0.05;

/** Fallback industry P/E when market data unavailable */
const DEFAULT_INDUSTRY_PE = 15;

/**
 * Compute share price and valuation metrics for a single team.
 *
 * Five-factor weighted model:
 *   sp1 (50%) — Book Value per share
 *   sp2 ( 3%) — P/E method (industry avg P/E × EPS)
 *   sp3 ( 1%) — DCF method (discounted future earnings)
 *   sp4 ( 1%) — Gordon DDM (dividend discount model)
 *   sp5 (40%) — EVA method (NOPAT/WACC + tax shield − debt)
 *
 * ESPRICE = 0.50×sp1 + 0.03×sp2 + 0.01×sp3 + 0.01×sp4 + 0.40×sp5
 * Floor: ESPRICE ≥ face_value / 2
 */
export async function runValuationModule(
  input: ValuationModuleInput
): Promise<ValuationModuleOutput> {
  // Source: n5pro.PRG — share price section
  const { financials, gameaid } = input;
  const {
    netinc, itax, toteq, totfin, totlnglib,
    totast, totcurlib, eshares: rawShares, eqdiv,
    retearn, sprem,
  } = financials;

  // Guard: at least 1 share to avoid division by zero
  const eshares = Math.max(rawShares, 1);

  // ═══════════════════════════════════════════════════════════════════
  // sp1 — Book Value per Share (Net Worth basis)
  // ═══════════════════════════════════════════════════════════════════
  // toteq carries equity capital at face value only (Fix 3). Net worth
  // adds retained earnings + securities premium so book value matches
  // the legacy BOOKVAL calc in n5pro.PRG.
  const netWorth = toteq + (retearn ?? 0) + (sprem ?? 0);
  const sp1 = netWorth / eshares;

  // ═══════════════════════════════════════════════════════════════════
  // sp2 — P/E Method (Price/Earnings Multiple)
  // ═══════════════════════════════════════════════════════════════════
  const eps = netinc / eshares;
  const industryPE = input.industryAvgPE > 0
    ? input.industryAvgPE
    : DEFAULT_INDUSTRY_PE;
  const sp2 = industryPE * eps;

  // ═══════════════════════════════════════════════════════════════════
  // sp3 — DCF Method (PV of next 4 quarters at WACC)
  // ═══════════════════════════════════════════════════════════════════
  // netinc is a single-quarter P&L figure; the FoxPro valuation model
  // divides by 4 before discounting 4 future quarterly cash flows.
  const quarterlyEarnings = netinc / 4;
  let dcfValue = 0;
  for (let q = 1; q <= 4; q++) {
    dcfValue += quarterlyEarnings / Math.pow(1 + ENGINE_CONSTANTS.WACC, q);
  }
  const sp3 = dcfValue / eshares;

  // ═══════════════════════════════════════════════════════════════════
  // sp4 — Gordon DDM (Dividend Discount Model)
  // ═══════════════════════════════════════════════════════════════════
  // P = D1 / (r − g) where D1 = annualised DPS, r = cost of equity
  const dps = eqdiv / eshares;
  const annualDividend = dps * 4; // annualise quarterly dividend
  const coe = DEFAULT_COST_OF_EQUITY;
  const growthRate = DEFAULT_GROWTH_RATE;
  const sp4 = annualDividend > 0
    ? annualDividend / Math.max(coe - growthRate, 0.01)
    : sp1; // fallback to book value if no dividend

  // ═══════════════════════════════════════════════════════════════════
  // sp5 — EVA Method
  // ═══════════════════════════════════════════════════════════════════
  // NOPAT = (PBT + interest) × (1 − tax rate)  — adds back financing cost.
  // GAMEAID.itaxrate is stored as a percent (30) in MPA-iipm; coerce to
  // a fraction so NOPAT doesn't flip sign (same convention used in
  // FinancialModule). Values ≤ 1 are assumed already fractional.
  const taxFrac = gameaid.itaxrate > 1 ? gameaid.itaxrate / 100 : gameaid.itaxrate;
  const pbt = netinc + itax;
  const nopat = (pbt + totfin) * (1 - taxFrac);

  // Tax shield on debt
  const taxShield = totlnglib * taxFrac;

  // Firm equity value per share = (operating value + tax shield − debt) / shares
  let sp5 = (nopat / ENGINE_CONSTANTS.WACC + taxShield - totlnglib) / eshares;

  // Floor sp5 at 50% of book value to prevent negative drag
  sp5 = Math.max(sp5, sp1 * 0.5);

  // ═══════════════════════════════════════════════════════════════════
  // WEIGHTED SHARE PRICE
  // ═══════════════════════════════════════════════════════════════════
  const w = ENGINE_CONSTANTS.SHARE_PRICE_WEIGHTS;
  let esprice = w.bookValue * sp1
              + w.pem      * sp2
              + w.dcf      * sp3
              + w.ddm      * sp4
              + w.eva      * sp5;

  // Floor: share price cannot fall below half of face value
  esprice = Math.max(esprice, gameaid.eqfv / 2);

  // ═══════════════════════════════════════════════════════════════════
  // DERIVED METRICS
  // ═══════════════════════════════════════════════════════════════════
  const marketCap = esprice * rawShares;
  const bookValuePerShare = sp1;

  return { esprice, marketCap, eps, bookValuePerShare };
}

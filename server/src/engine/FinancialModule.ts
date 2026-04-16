/**
 * FinancialModule — STEP 7 of quarter processing pipeline.
 *
 * Assembles the complete Profit & Loss statement and Balance Sheet.
 * Computes COGS using ACP method, applies tax with loss carry-forward,
 * enforces dividend constraints, and builds the balance sheet.
 *
 * **FoxPro Source:** `n5pro.PRG` — P&L + BSHEET sections
 *
 * @module engine/FinancialModule
 */

import { ENGINE_CONSTANTS } from './constants';
import type {
  FinancialModuleInput,
  FinancialModuleOutput,
  FinancialState,
  PandlDetail,
} from './types';

/**
 * Compute the full P&L and Balance Sheet for a single team.
 *
 * Processing order:
 *   1. Revenue (actual sales × price)
 *   2. COGS via ACP method (opening FG value + production cost − closing FG value)
 *   3. Operating expenses (S&A, R&D, bad debts, cash discounts)
 *   4. Depreciation (delta between current and previous accumulated depreciation)
 *   5. Financial costs (total loan + shark interest from LoanModule)
 *   6. PBT → tax with loss carry-forward → PAT
 *   7. Dividend validation (5 constraints, all must pass)
 *   8. Balance Sheet: equity, fixed assets, current assets, liabilities
 *   9. Financial ratios (current ratio, D/E, asset turnover)
 */
export async function runFinancialModule(
  input: FinancialModuleInput
): Promise<FinancialModuleOutput> {
  // Source: n5pro.PRG — P&L + BSHEET sections
  const {
    teamNo, decision, cashFlow, production, costs, capacity,
    prevCapacity, prevFinancials, prevSaleState, gameaid, forecast, loans,
  } = input;

  // ── Convenience arrays ──────────────────────────────────────────
  const prices: [number, number, number, number] = [
    decision.price1, decision.price2, decision.price3, decision.price4,
  ];
  const sales = production.actualSales;
  const openFG = production.openFG;
  const closingFG = production.closingFG;
  const discounts: [number, number, number, number] = [
    decision.dscnt1, decision.dscnt2, decision.dscnt3, decision.dscnt4,
  ];
  const prevAcp: [number, number, number, number] = [
    prevSaleState.acp1, prevSaleState.acp2,
    prevSaleState.acp3, prevSaleState.acp4,
  ];
  const acp = costs.acp; // Current quarter ACP per product from CostModule

  // ═══════════════════════════════════════════════════════════════════
  // P&L ASSEMBLY
  // ═══════════════════════════════════════════════════════════════════

  // ── 1. Revenue ──────────────────────────────────────────────────
  let srev = 0;
  for (let p = 0; p < 4; p++) {
    srev += sales[p] * prices[p];
  }
  // Contract revenue = 0 (placeholder — integrate ContractModule later)

  // ── 2. COGS (ACP method) ───────────────────────────────────────
  // Opening FG value = Σ(openFG[p] × prevACP[p])
  let openFGvalue = 0;
  for (let p = 0; p < 4; p++) {
    openFGvalue += openFG[p] * prevAcp[p];
  }

  const productionCost = costs.productionCost; // mat + lab + wh + ovh

  // Closing FG value = Σ(closingFG[p] × current ACP[p])
  let closeFGvalue = 0;
  for (let p = 0; p < 4; p++) {
    closeFGvalue += closingFG[p] * acp[p];
  }

  // COGS = opening + production − closing
  const cofgs = openFGvalue + productionCost - closeFGvalue;
  const gprofit = srev - cofgs;

  // ── 3. Operating expenses ──────────────────────────────────────
  const sadexp = costs.totalSAD;
  const randexp = costs.rndExpense;

  // Bad debts: srev × (5 − GENECO) / 400, floored at 0
  const bdebts = Math.max(
    0,
    srev * (ENGINE_CONSTANTS.BAD_DEBT_BASE - forecast.geneco)
         / ENGINE_CONSTANTS.BAD_DEBT_DIVISOR,
  );

  // Cash discounts: Σ(sales[p] × price[p] × discount[p] / 100)
  let sdisc = 0;
  for (let p = 0; p < 4; p++) {
    sdisc += sales[p] * prices[p] * (discounts[p] / 100);
  }

  // ── 4. Depreciation (period from CapacityModule) ────────────────
  // After Fix 3, CapacityModule.deprecm/deprecp carry the CURRENT
  // period charge (not cumulative), so we use them directly. Fix 4
  // folds this same figure into productionCost so COGS already
  // contains it; PBT below therefore does NOT subtract deprec again.
  const deprec = capacity.deprecp + capacity.deprecm;

  // ── 5. Financial costs (from LoanModule) ───────────────────────
  const totfin = loans.totalInterest + loans.sharkInterest;

  // ── 6. Extraordinary items (EventModule placeholder) ───────────
  const extitem = 0;

  // ── 7. PBT → Tax → PAT ────────────────────────────────────────
  // Depreciation is NOT subtracted here because it is already part of
  // productionCost (Fix 4) and therefore already in COGS → gprofit.
  const pbt = gprofit - sadexp - randexp - bdebts - sdisc
            - totfin + extitem;

  const prevCumLoss = prevFinancials.cumloss || 0;
  const taxableIncome = pbt - prevCumLoss;

  // GAMEAID.itaxrate is stored as a percent (0–100) in the legacy DBF,
  // so divide by 100 to get the effective rate. Support both conventions:
  // values <= 1 are assumed to be already-fractional (e.g. 0.30).
  const effectiveTaxRate = gameaid.itaxrate > 1
    ? gameaid.itaxrate / 100
    : gameaid.itaxrate;
  let itax: number;
  let cumloss: number;
  if (taxableIncome > 0) {
    itax = taxableIncome * effectiveTaxRate;
    cumloss = 0;
  } else {
    itax = 0;
    cumloss = prevCumLoss + Math.max(0, -pbt);
  }

  const netinc = pbt - itax; // PAT

  // ═══════════════════════════════════════════════════════════════════
  // EQUITY ISSUE — tender price (legacy n5pro.PRG lines 2099-2137)
  // ═══════════════════════════════════════════════════════════════════
  // DTABLE.EQUPRI is an *issue code* in the legacy schema (100 = "at
  // tender"), NOT a price per share. Legacy computes the tender price
  // IN-FLIGHT each quarter:
  //   spf = spnf / (1.05 + 0.01 × (equNo / toteq)) − 20000 / equNo
  //   spnf = share price after valuation (current quarter)
  // Legacy computes valuation inside the same routine that issues equity,
  // but our pipeline runs ValuationModule AFTER FinancialModule, so we
  // read the previous quarter's stored EQTND instead. Q0 is seeded with
  // the empirical Q1 tender value (2.06 for MPA-iipm) so Q1 round-trips
  // against the golden. The issue price is floored at face value so an
  // underwater issue cannot produce negative share premium.
  const prevEshares = prevFinancials.eshares || 1;
  const newShares = decision.equNo || 0;
  const eshares = prevEshares + newShares;

  let effectiveTenderPrice = 0;
  let equityIssueProceeds = 0;
  let securitiesPremium = 0;
  if (newShares > 0) {
    const prevEqtnd = prevFinancials.eqtnd || prevFinancials.esprice || gameaid.eqfv;
    effectiveTenderPrice = Math.max(prevEqtnd, gameaid.eqfv);
    equityIssueProceeds = newShares * effectiveTenderPrice;
    securitiesPremium = newShares * (effectiveTenderPrice - gameaid.eqfv);
  }

  const equityCapital = eshares * gameaid.eqfv;

  // decision.equDiv = dividend per share; total = DPS × previous shares
  const proposedEqDiv = (decision.equDiv || 0) * prevEshares;

  let eqdiv = 0;
  if (netinc > 0 && proposedEqDiv > 0) {
    // C1: No outstanding unpaid interest (interest paid via LoanModule)
    const c1 = true;
    // C2: No unpaid preference dividends (assumed current)
    const c2 = true;
    // C3: Dividend ≤ outstanding loans + preference capital
    const totalOutstandingLoans = loans.updatedLoans.reduce(
      (sum, l) => sum + l.amountdue, 0,
    );
    const c3 = proposedEqDiv <= totalOutstandingLoans + prevFinancials.totpref;
    // C4: Dividend ≤ retained earnings + equity capital
    const retainedAfterProfit = prevFinancials.retearn + netinc;
    const c4 = proposedEqDiv <= retainedAfterProfit + equityCapital;
    // C5: Dividend ≤ average last-4-quarter PAT (simplified: current PAT)
    const c5 = proposedEqDiv <= netinc;

    if (c1 && c2 && c3 && c4 && c5) {
      eqdiv = proposedEqDiv;
    }
  }

  // Preference dividend: quarterly portion of annual rate
  const pdiv = (gameaid.prefdiv * (prevFinancials.totpref || 0)) / 4;

  // ═══════════════════════════════════════════════════════════════════
  // BALANCE SHEET ASSEMBLY
  // ═══════════════════════════════════════════════════════════════════

  // ── Equity ──────────────────────────────────────────────────────
  // Legacy n5pro.PRG line 2218: RETEARN = reteold + NETINC + sprem
  // Securities premium rolls into retained earnings, not a separate
  // reserve. Dividends reduce retearn in our model (legacy handles this
  // via a separate CASHTAB path but the end state is equivalent).
  const retearn = prevFinancials.retearn + netinc - eqdiv - pdiv + securitiesPremium;

  // Legacy TTOTEQ stores equity capital at face value only (eshares × eqfv).
  // Retained earnings and securities premium are tracked separately on the
  // balance sheet and do NOT aggregate into TOTEQ. Verified against
  // MPA-iipm BSHEET.DBF Q1 team 0: TOTEQ = 8,750,000 = 8.75M shares × ₹1.
  const toteq = equityCapital;

  // ── Preference capital ─────────────────────────────────────────
  const pshares = (prevFinancials.pshares || 0) + (decision.prefNo || 0);
  const newPrefValue = (decision.prefNo || 0) > 0
    ? (decision.prefNo || 0) * (decision.prefPri || gameaid.preffv)
    : 0;
  const totpref = prevFinancials.totpref + newPrefValue;

  // ── Fixed assets ───────────────────────────────────────────────
  const capExpPlant = capacity.newpcap * gameaid.pcapcost;
  const capExpMachine = capacity.newmcap * gameaid.mcapcost;
  const totfixast = prevFinancials.totfixast + capExpPlant + capExpMachine - deprec;

  // ── Current assets ─────────────────────────────────────────────
  // CashFlowModule computed endcash BEFORE the shark-loan auto-trigger ran,
  // so the proceeds must be added back here to keep the balance sheet in
  // balance (shkpayble appears on the liability side below).
  const cashhand = cashFlow.endcash + (loans.sharkLoan || 0);

  // Accounts receivable — prefer the closingAR figure computed inside
  // CashFlowModule (Fix 6) so AR tracks the actual per-product
  // collection split. Legacy fallback kept for the pre-Fix callers.
  const arecble = cashFlow.closingAR ?? Math.max(
    0,
    prevFinancials.arecble
      + srev * (1 - gameaid.cashsale / 100)
      - cashFlow.scolp,
  );

  // Closing inventory value (FG + RM)
  let closeinv = closeFGvalue;
  closeinv += production.closingRM[0] * production.wax;
  closeinv += production.closingRM[1] * production.way;

  const totcurast = cashhand + arecble + closeinv;

  // ── Current liabilities ────────────────────────────────────────
  const acpayble = cashFlow.edmatp + cashFlow.edlabp;
  const stlpayble = decision.stl || 0;
  const shkpayble = loans.sharkLoan || 0;
  // Loans maturing within 1 quarter count as current
  const loansDueSoon = loans.updatedLoans
    .filter(l => l.endsin <= 1)
    .reduce((sum, l) => sum + l.amountdue, 0);
  const totcurlib = acpayble + stlpayble + shkpayble + loansDueSoon;

  // ── Long-term liabilities ──────────────────────────────────────
  const totlnglib = loans.updatedLoans
    .filter(l => l.endsin > 1)
    .reduce((sum, l) => sum + l.amountdue, 0);

  // ── Totals ─────────────────────────────────────────────────────
  const totast = totfixast + totcurast;
  const totlib = totcurlib + totlnglib;

  // ── Financial ratios ───────────────────────────────────────────
  const cratio = totcurast / Math.max(totcurlib, 1);
  const de = totlnglib / Math.max(toteq, 1);
  const atr = srev / Math.max(totast, 1);

  // Share price: placeholder until ValuationModule updates it (Step 9)
  const esprice = prevFinancials.esprice || gameaid.eqfv;

  // ── EQTND for NEXT quarter ─────────────────────────────────────
  // Legacy formula with current quarter's share price (spnf). Since
  // ValuationModule hasn't run yet, we use the carried esprice as a
  // proxy. Floored at eqfv so an underwater tender can't go negative.
  // This value is stored on PANDL.EQTND and read by NEXT quarter's
  // FinancialModule as the issue price.
  const eqtndDivisor = 1.05 + 0.01 * (newShares > 0 ? newShares / Math.max(toteq, 1) : 0.25);
  const rawNextEqtnd = esprice / eqtndDivisor - (newShares > 0 ? 20000 / newShares : 0);
  const eqtnd = Math.max(rawNextEqtnd, gameaid.eqfv);

  // ═══════════════════════════════════════════════════════════════════
  // ASSEMBLE OUTPUT
  // ═══════════════════════════════════════════════════════════════════
  const financials: FinancialState = {
    teamNo,
    // P&L
    srev, gprofit, netinc, sadexp, randexp, bdebts,
    totfin, itax, eqdiv, pdiv, deprec, extitem, cumloss,
    // Balance Sheet
    toteq, totpref, retearn, eshares, pshares, esprice,
    totfixast, totcurast, totcurlib, totlnglib, totast, totlib,
    cashhand, arecble, closeinv, cratio, de, atr,
    eqtnd, sprem: securitiesPremium, psprem: 0,
    // Cash
    opencash: cashFlow.opencash,
    endcash: cashFlow.endcash + (loans.sharkLoan || 0),
  };

  // ═══════════════════════════════════════════════════════════════════
  // PANDL DETAIL (line items not carried on FinancialState)
  // ═══════════════════════════════════════════════════════════════════
  const pandlDetail: PandlDetail = {
    openinv: openFGvalue,
    closinvFG: closeFGvalue,
    matrls: costs.materialCost,
    labour: costs.laborCost,
    whose: costs.warehouseCost,
    othovh: costs.overheadCost,
    prodcost: productionCost,
    totdircst: costs.materialCost + costs.laborCost,
    cofgs,
    miscexp: 0,
  };

  return {
    financials,
    acp1: acp[0],
    acp2: acp[1],
    acp3: acp[2],
    acp4: acp[3],
    pandlDetail,
  };
}

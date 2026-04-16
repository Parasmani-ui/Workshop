/**
 * LoanModule — STEP 8 of quarter processing pipeline.
 *
 * Processes all loan operations for a single team in a quarter:
 *  - Dynamic interest rate calculation (GETINT — 7 risk premium components)
 *  - EMI (EQI) amortisation via standard annuity formula
 *  - Servicing of existing loans (interest + principal repayment)
 *  - Issuance of new loans from team decisions (STL, 2YR, 3YR, BOND)
 *  - Shark loan auto-trigger when ending cash < minimum cash
 *
 * **FoxPro Source:** `AREPAY.PRG` — full EQI + GETINT functions
 *
 * @module engine/LoanModule
 */

import { ENGINE_CONSTANTS } from './constants';
import type { LoanModuleInput, LoanModuleOutput, LoanEntry } from './types';

const DEBUG = process.env.LOAN_DEBUG === 'true';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS (internal to LoanModule)
// ═══════════════════════════════════════════════════════════════════

/**
 * Tenure premium bands — longer-duration loans carry more risk.
 * Source: AREPAY.PRG — tenure adjustment section.
 * Values in percentage points (e.g. 0.50 = 0.50%).
 */
const TENURE_PREMIUM_BANDS = [
  { maxQuarters: 1,        premium: 0.25 },  // STL
  { maxQuarters: 8,        premium: 0.50 },  // 2-year term loan
  { maxQuarters: 12,       premium: 0.75 },  // 3-year term loan
  { maxQuarters: Infinity, premium: 1.00 },  // Bond (16Q+)
] as const;

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Look up the first matching band where `value <= band.limit`.
 * Falls back to the last band if value exceeds all limits.
 */
function lookupBand<T extends { readonly limit: number }>(
  bands: ReadonlyArray<T>,
  value: number,
): T {
  for (const band of bands) {
    if (value <= band.limit) return band;
  }
  return bands[bands.length - 1];
}

/** Look up tenure premium for a loan of given duration (quarters). */
function lookupTenurePremium(durationQuarters: number): number {
  for (const band of TENURE_PREMIUM_BANDS) {
    if (durationQuarters <= band.maxQuarters) return band.premium;
  }
  return TENURE_PREMIUM_BANDS[TENURE_PREMIUM_BANDS.length - 1].premium;
}

// ═══════════════════════════════════════════════════════════════════
// GETINT — Dynamic Interest Rate (AREPAY.PRG)
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute a team-specific annual interest rate for a loan.
 *
 * Seven risk premium components are summed onto the base CIBOR:
 *
 *  1. **Base rate** — CIBOR / PLR (`forecast.intrate`), decimal form
 *     (e.g. 0.10 = 10% annual).
 *  2. **Liquidity premium** — based on total outstanding debt.
 *     ENGINE_CONSTANTS values are percentage points; divided by 100
 *     to convert to decimal (0.75 → 0.0075).
 *  3. **Current ratio risk** — lower CR → higher premium.
 *  4. **D/E ratio risk** — higher leverage → higher premium.
 *  5. **Tenure premium** — longer duration → higher premium.
 *  6. **Revenue volatility premium** — std-dev of recent revenue
 *     (TODO: requires 4-quarter history).
 *  7. **Depreciation premium** — high depreciation vs. assets
 *     (TODO: requires multi-quarter asset data).
 *
 * @param baseCIBOR          Annual rate in decimal (e.g. 0.10 = 10%)
 * @param totalBorrowing     Sum of all outstanding loan balances
 * @param currentRatio       Team current ratio (totcurast / totcurlib)
 * @param deRatio            Team debt-to-equity ratio
 * @param loanDurationQ      Loan duration in quarters
 * @returns Annual interest rate in decimal (e.g. 0.1375 = 13.75%)
 */
function getInterestRate(
  baseCIBOR: number,
  totalBorrowing: number,
  currentRatio: number,
  deRatio: number,
  loanDurationQ: number,
): number {
  // Component 1: Base rate (already decimal)
  const baseRate = baseCIBOR;

  // Component 2: Liquidity premium — percentage points → decimal
  const liquidityPremium =
    lookupBand(ENGINE_CONSTANTS.LIQUIDITY_PREMIUM_BANDS, totalBorrowing).premium / 100;

  // Component 3: Current ratio risk — percentage points → decimal
  const currentRatioRisk =
    lookupBand(ENGINE_CONSTANTS.CURRENT_RATIO_RISK_BANDS, currentRatio).risk / 100;

  // Component 4: D/E ratio risk — percentage points → decimal
  const deRiskPremium =
    lookupBand(ENGINE_CONSTANTS.DE_RISK_BANDS, deRatio).risk / 100;

  // Component 5: Tenure premium — percentage points → decimal
  const tenurePremium = lookupTenurePremium(loanDurationQ) / 100;

  // Component 6: Revenue volatility (TODO: needs 4-quarter history)
  const volatilityPremium = 0;

  // Component 7: Depreciation premium (TODO: needs multi-quarter data)
  const depreciationPremium = 0;

  const annualRate =
    baseRate +
    liquidityPremium +
    currentRatioRisk +
    deRiskPremium +
    tenurePremium +
    volatilityPremium +
    depreciationPremium;

  if (DEBUG) {
    console.log(
      `  GETINT: base=${baseRate} liq=${liquidityPremium} cr=${currentRatioRisk} ` +
        `de=${deRiskPremium} tenure=${tenurePremium} → annual=${annualRate}`,
    );
  }

  return annualRate;
}

// ═══════════════════════════════════════════════════════════════════
// EQI — Equal Quarterly Instalment / EMI (AREPAY.PRG)
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate the Equal Quarterly Instalment (EQI / EMI) for a loan.
 *
 * Standard annuity formula from AREPAY.PRG:
 *
 *   af = {1 − 1/(1+r)^n} / r
 *   EMI = P / af
 *
 * Where P = outstanding principal, r = quarterly rate (decimal),
 * n = quarters remaining.
 *
 * Each EMI payment is split into interest and principal portions:
 *   interestPart  = P × r
 *   principalPart = EMI − interestPart
 *
 * Edge cases:
 *  - n = 1: repay full principal + one quarter interest
 *  - r = 0: straight-line (principal / n)
 *  - P ≤ 0 or n ≤ 0: no payment due
 *
 * @param principal          Outstanding balance (amountdue)
 * @param quarterlyRate      Quarterly interest rate in decimal (e.g. 0.03)
 * @param quartersRemaining  Number of quarters left on this loan
 */
function calculateEQI(
  principal: number,
  quarterlyRate: number,
  quartersRemaining: number,
): { emi: number; interestPart: number; principalPart: number } {
  // Guard: nothing owed or expired
  if (principal <= 0 || quartersRemaining <= 0) {
    return { emi: 0, interestPart: 0, principalPart: 0 };
  }

  // Edge: zero-rate loan → straight division
  if (quarterlyRate === 0) {
    const emi = principal / quartersRemaining;
    return { emi, interestPart: 0, principalPart: emi };
  }

  // Edge: last quarter → repay full balance + one period's interest
  if (quartersRemaining === 1) {
    const interestPart = principal * quarterlyRate;
    const emi = principal + interestPart;
    return { emi, interestPart, principalPart: principal };
  }

  // Standard annuity formula
  const af =
    (1 - 1 / Math.pow(1 + quarterlyRate, quartersRemaining)) / quarterlyRate;
  const emi = principal / af;
  const interestPart = principal * quarterlyRate;
  const principalPart = emi - interestPart;

  return { emi, interestPart, principalPart };
}

// ═══════════════════════════════════════════════════════════════════
// runLoanModule — Main entry point
// ═══════════════════════════════════════════════════════════════════

/**
 * Process all loan activity for a single team in a quarter.
 *
 * Processing order:
 *  1. Service existing loans — recalculate rate via GETINT, compute
 *     EMI, split into interest + principal, update outstanding balance.
 *  2. Remove fully repaid loans (amountdue ≤ 0 or endsin ≤ 0).
 *  3. Issue new loans from team decisions (STL, 2YR, 3YR, BOND).
 *  4. Shark loan auto-trigger if endcash < mincash.
 *
 * NOTE: Prepayment handling (LENTRY codes E/F/P) is not yet modelled
 * because the current TeamDecision type has no prepayment instruction
 * fields. All existing loans receive standard EMI treatment.
 * TODO: Add LENTRY prepayment support when types are extended.
 */
export async function runLoanModule(
  input: LoanModuleInput,
): Promise<LoanModuleOutput> {
  const { decision, existingLoans, financials, gameaid, forecast } = input;

  const baseCIBOR = forecast.intrate;
  const currentRatio = financials.cratio;
  const deRatio = financials.de;

  // Total outstanding debt — used by GETINT liquidity premium
  const totalBorrowing = existingLoans.reduce(
    (sum, l) => sum + l.amountdue,
    0,
  );

  let totalInterest = 0;
  let totalEMI = 0;
  const updatedLoans: LoanEntry[] = [];

  if (DEBUG) {
    console.log(
      `\n[LoanModule] team=${input.teamNo} existingLoans=${existingLoans.length} ` +
        `CIBOR=${baseCIBOR} CR=${currentRatio} D/E=${deRatio}`,
    );
  }

  // ── Step 1: Service existing loans ─────────────────────────────

  for (const loan of existingLoans) {
    if (loan.amountdue <= 0 || loan.endsin <= 0) continue;

    // Recalculate dynamic rate via GETINT for ALL loan types.
    // FoxPro AREPAY.PRG calls GETINT for each loan each quarter;
    // bonds in the legacy system also get re-priced unless a future
    // extension adds a fixed-rate flag.
    const annualRate = getInterestRate(
      baseCIBOR,
      totalBorrowing,
      currentRatio,
      deRatio,
      loan.duration,
    );
    const quarterlyRate = annualRate / 4;

    const { emi, interestPart, principalPart } = calculateEQI(
      loan.amountdue,
      quarterlyRate,
      loan.endsin,
    );

    totalInterest += interestPart;
    totalEMI += emi;

    // Update outstanding balance and remaining quarters
    const remainingBalance = loan.amountdue - principalPart;
    const remainingQuarters = loan.endsin - 1;

    if (DEBUG) {
      console.log(
        `  Loan #${loan.loanNo}: due=${loan.amountdue.toFixed(2)} ` +
          `rate=${(quarterlyRate * 100).toFixed(3)}% qtr emi=${emi.toFixed(2)} ` +
          `int=${interestPart.toFixed(2)} prin=${principalPart.toFixed(2)} ` +
          `remaining=${remainingBalance.toFixed(2)} endsin=${remainingQuarters}`,
      );
    }

    // Keep loan if it still has balance and quarters remaining
    if (remainingBalance > 0.01 && remainingQuarters > 0) {
      updatedLoans.push({
        loanNo: loan.loanNo,
        lamount: loan.lamount,
        intrate: quarterlyRate,
        duration: loan.duration,
        amountdue: remainingBalance,
        emi,
        endsin: remainingQuarters,
      });
    }
  }

  // ── Step 2: Issue new loans ────────────────────────────────────

  let nextLoanNo =
    existingLoans.length > 0
      ? Math.max(...existingLoans.map((l) => l.loanNo)) + 1
      : 1;

  // Include new debt in borrowing total for GETINT calculation
  const newDebt =
    (decision.stl || 0) +
    (decision.ntwLoan || 0) +
    (decision.nthLoan || 0) +
    (decision.nBond || 0);
  const totalBorrowingWithNew = totalBorrowing + newDebt;

  /**
   * Create and register a new loan from a team decision.
   *
   * Computes the interest rate via GETINT (unless fixedAnnualRate
   * is provided for fixed-coupon instruments), calculates the
   * initial EMI, and pushes the loan onto updatedLoans.
   */
  const issueLoan = (
    amount: number,
    durationQ: number,
    fixedAnnualRate?: number,
  ): void => {
    if (amount <= 0) return;

    const annualRate =
      fixedAnnualRate != null
        ? fixedAnnualRate
        : getInterestRate(
            baseCIBOR,
            totalBorrowingWithNew,
            currentRatio,
            deRatio,
            durationQ,
          );
    const qRate = annualRate / 4;

    // Compute initial EMI for the record
    let emi: number;
    if (qRate === 0) {
      emi = amount / durationQ;
    } else if (durationQ === 1) {
      emi = amount + amount * qRate;
    } else {
      const af = (1 - 1 / Math.pow(1 + qRate, durationQ)) / qRate;
      emi = amount / af;
    }

    const newLoan: LoanEntry = {
      loanNo: nextLoanNo++,
      lamount: amount,
      intrate: qRate,
      duration: durationQ,
      amountdue: amount,
      emi,
      endsin: durationQ,
    };

    updatedLoans.push(newLoan);

    if (DEBUG) {
      console.log(
        `  NEW Loan #${newLoan.loanNo}: amount=${amount} dur=${durationQ}Q ` +
          `annual=${(annualRate * 100).toFixed(2)}% qRate=${(qRate * 100).toFixed(3)}% ` +
          `emi=${emi.toFixed(2)}`,
      );
    }
  };

  // Short-term loan — 1 quarter, repaid in full next quarter
  issueLoan(decision.stl, 1);

  // 2-year term loan — 8 quarters
  issueLoan(decision.ntwLoan, 8);

  // 3-year term loan — 12 quarters
  issueLoan(decision.nthLoan, 12);

  // Bond — 16 quarters, rate fixed at issuance
  if (decision.nBond > 0) {
    const bondAnnualRate = getInterestRate(
      baseCIBOR,
      totalBorrowingWithNew,
      currentRatio,
      deRatio,
      16,
    );
    issueLoan(decision.nBond, 16, bondAnnualRate);
  }

  // ── Step 3: Shark loan auto-trigger ────────────────────────────
  //
  // CLAUDE.md Section 6:
  //   IF endcash < minCash:
  //     sharkLoan = minCash − endcash
  //     sharkInterest = sharkLoan × 4 × CIBOR / 4 = sharkLoan × CIBOR
  //   Triggers AFTER all other processing; recalculates P&L and BS.

  let sharkLoan = 0;
  let sharkInterest = 0;

  // Strict less-than: if endcash exactly equals mincash, shark does NOT
  // fire (treating equality as "at the minimum" not "below it").
  if (financials.endcash < gameaid.mincash) {
    // Only borrow the shortfall. sharkLoan > 0 is guaranteed because
    // endcash is strictly less than mincash.
    sharkLoan = gameaid.mincash - financials.endcash;

    // Shark rate = SHARK_LOAN_RATE_MULTIPLIER × CIBOR (annual)
    // Quarterly interest = sharkLoan × sharkAnnualRate / 4
    //                    = sharkLoan × (4 × CIBOR) / 4
    //                    = sharkLoan × CIBOR
    const sharkAnnualRate =
      baseCIBOR * ENGINE_CONSTANTS.SHARK_LOAN_RATE_MULTIPLIER;
    const sharkQuarterlyRate = sharkAnnualRate / 4;
    sharkInterest = sharkLoan * sharkQuarterlyRate;

    updatedLoans.push({
      loanNo: nextLoanNo++,
      lamount: sharkLoan,
      intrate: sharkQuarterlyRate,
      duration: 1,
      amountdue: sharkLoan,
      emi: sharkLoan + sharkInterest,
      endsin: 1,
    });

    // NOTE: sharkInterest is returned as a separate field and must NOT
    // be rolled into totalInterest, otherwise FinancialModule
    //   totfin = loans.totalInterest + loans.sharkInterest
    // will double-count it.

    console.log(
      `[LoanModule] Team ${input.teamNo}: SHARK LOAN triggered. ` +
        `endCash=${financials.endcash}, mincash=${gameaid.mincash}, ` +
        `sharkAmount=${sharkLoan}, sharkInterest=${sharkInterest}`,
    );
  }

  if (DEBUG) {
    console.log(
      `  TOTALS: interest=${totalInterest.toFixed(2)} emi=${totalEMI.toFixed(2)} ` +
        `loans=${updatedLoans.length} sharkLoan=${sharkLoan.toFixed(2)}`,
    );
  }

  return {
    updatedLoans,
    totalInterest,
    totalEMI,
    sharkLoan,
    sharkInterest,
  };
}

// ═══════════════════════════════════════════════════════════════════
// SANITY TESTS — run via: npx ts-node src/engine/LoanModule.ts
// ═══════════════════════════════════════════════════════════════════

if (require.main === module) {
  const { FinancialState, GameAidConfig, ForecastParams, TeamDecision } =
    {} as any; // type-only — not used at runtime

  // ── Minimal stubs for test harness ─────────────────────────────

  const makeDecision = (overrides: Partial<Record<string, number>> = {}): any => ({
    teamNo: 0,
    prod1: 0, prod2: 0, prod3: 0, prod4: 0,
    price1: 0, price2: 0, price3: 0, price4: 0,
    raw1: 0, raw2: 0,
    fsad1: 0, fsad2: 0, fsad3: 0, fsad4: 0,
    vsad1: 0, vsad2: 0, vsad3: 0, vsad4: 0,
    dscnt1: 0, dscnt2: 0, dscnt3: 0, dscnt4: 0,
    newPCap: 0, newMCap: 0,
    stl: 0, ntwLoan: 0, nthLoan: 0, nBond: 0,
    equDiv: 0, equNo: 0, equPri: 0,
    rand1: 0, rand2: 0,
    crPrd: 0,
    alliance1: 0, alliance2: 0, alliance3: 0, alliance4: 0,
    cprod1: 0, cprod2: 0, cprod3: 0, cprod4: 0,
    cprice1: 0, cprice2: 0, cprice3: 0, cprice4: 0,
    strset: 0, bdisc: 0,
    train1: 0, train2: 0, train3: 0, train4: 0,
    prefNo: 0, prefPri: 0,
    ...overrides,
  });

  const makeFinancials = (overrides: Partial<Record<string, number>> = {}): any => ({
    teamNo: 0,
    srev: 0, gprofit: 0, netinc: 0, sadexp: 0, randexp: 0,
    bdebts: 0, totfin: 0, itax: 0, eqdiv: 0, pdiv: 0,
    deprec: 0, extitem: 0, cumloss: 0,
    toteq: 1_000_000, totpref: 0, retearn: 500_000,
    eshares: 100_000, pshares: 0, esprice: 10,
    totfixast: 2_000_000, totcurast: 1_500_000,
    totcurlib: 800_000, totlnglib: 500_000,
    totast: 3_500_000, cashhand: 700_000,
    arecble: 300_000, closeinv: 500_000,
    cratio: 1.875, de: 0.50, atr: 1.2,
    opencash: 700_000, endcash: 700_000,
    ...overrides,
  });

  const makeGameaid = (overrides: Partial<Record<string, any>> = {}): any => ({
    gameid: 'TEST',
    nooft: 6, bmatcostx: 100, bmatcosty: 50,
    blabcost1: 10, blabcost2: 12, blabcost3: 14, blabcost4: 16,
    blabslab1: 20000, blabslab2: 30000, blabslab3: 40000,
    bwhcost1: 2, bwhcost2: 3, bwhcost3: 4,
    bwhslab1: 20000, bwhslab2: 50000,
    bovrhd1: 5, bovrhd2: 6, bovrhd3: 7,
    bovrhsb1: 30000, bovrhsb2: 60000,
    mcapcost: 500, pcapcost: 800,
    mlife: 8, plife: 20,
    eqfv: 10, mincash: 500_000,
    cashsale: 40, itaxrate: 30, dtax: 0,
    prefdiv: 10, preffv: 100,
    wincrit: 'M', gametype: 'P',
    rm11: 2, rm12: 3, rm13: 1, rm14: 2,
    rm21: 1, rm22: 1, rm23: 1, rm24: 1,
    lama11: 1, lama21: 1, lamb11: 1, lamc11: 1,
    ...overrides,
  });

  const makeForecast = (overrides: Partial<Record<string, number>> = {}): any => ({
    quarterNo: 1,
    trend1: 100, trend2: 100, trend3: 100, trend4: 100,
    si1: 1, si2: 1, si3: 1, si4: 1,
    ci: 1, sensex: 1000, wpi: 100, gdp: 5, mindex: 100,
    intrate: 0.10, geneco: 3,
    fcasta1: 0, fcasta2: 0, fcasta3: 0, fcasta4: 0,
    demand1: 100000, demand2: 80000, demand3: 60000, demand4: 40000,
    matcostch1: 0, matcostch2: 0, labcostch: 0,
    conquant1: 0, conquant2: 0, conquant3: 0, conquant4: 0,
    expoinc1: 0, expoinc2: 0, expoinc3: 0, expoinc4: 0,
    cscolp1: 0.8, cscolp2: 0.8, cscolp3: 0.8, cscolp4: 0.8,
    rm1lim: 20, rm2lim: 20,
    shipqrt: 0, odsqueze: 0, riskp: 0,
    deltax: 0, dtaxch: 0, delwh: 0,
    mcost: 0, pcost: 0,
    procpri1: 0, procpri2: 0, procpri3: 0, procpri4: 0,
    blkrm1: 0, blkrm2: 0,
    ...overrides,
  });

  // ── Test runner ────────────────────────────────────────────────

  console.log('═══ LoanModule Sanity Tests ═══\n');
  let allPass = true;

  const assertClose = (
    label: string,
    actual: number,
    expected: number,
    tol = 1,
  ): void => {
    const pass = Math.abs(actual - expected) <= tol;
    if (!pass) {
      console.error(
        `  FAIL [${label}]: actual=${actual.toFixed(2)} expected=${expected.toFixed(2)} ` +
          `diff=${Math.abs(actual - expected).toFixed(4)}`,
      );
      allPass = false;
    } else {
      console.log(`  PASS [${label}]: ${actual.toFixed(2)} ≈ ${expected.toFixed(2)}`);
    }
  };

  // ── Test 1: EQI calculation (pure function) ───────────────────
  console.log('Test 1: EQI — 1M principal, 12% annual, 8 quarters');
  {
    const { emi, interestPart, principalPart } = calculateEQI(
      1_000_000,
      0.03, // 12% / 4 = 3% quarterly
      8,
    );
    assertClose('EMI', emi, 142_456, 1);
    assertClose('interestPart', interestPart, 30_000, 1);
    assertClose('principalPart', principalPart, 112_456, 1);

    // Verify total repayment does not exceed principal + reasonable interest
    const totalRepayment = emi * 8;
    console.log(`  Total repayment over 8Q: ${totalRepayment.toFixed(2)}`);
    console.log(`  Total interest: ${(totalRepayment - 1_000_000).toFixed(2)}`);
  }

  // ── Test 2: EQI edge — single quarter ─────────────────────────
  console.log('\nTest 2: EQI — single quarter (full repay)');
  {
    const { emi, interestPart, principalPart } = calculateEQI(
      500_000,
      0.025, // 10% / 4 = 2.5% quarterly
      1,
    );
    assertClose('EMI (1Q)', emi, 512_500, 1);
    assertClose('interest (1Q)', interestPart, 12_500, 1);
    assertClose('principal (1Q)', principalPart, 500_000, 1);
  }

  // ── Test 3: GETINT rate components ────────────────────────────
  console.log('\nTest 3: GETINT — low risk profile');
  {
    // Small borrowing (50K ≤ 100K → +0.75%), high CR (1.875 > 1.5 → +1.25%),
    // low D/E (0.50 ≤ 0.50 → +0.35%), STL (1Q → +0.25%)
    const rate = getInterestRate(0.10, 50_000, 1.875, 0.50, 1);
    // Expected: 0.10 + 0.0075 + 0.0125 + 0.0035 + 0.0025 = 0.126
    assertClose('low-risk rate', rate * 100, 12.60, 0.1);
  }

  console.log('\nTest 4: GETINT — high risk profile');
  {
    // Large borrowing (2M > 1M → +0.30%), low CR (0.8 ≤ 0.99 → +2.00%),
    // high D/E (3.2 ≤ 3.5 → +1.30%), 3YR (12Q → +0.75%)
    const rate = getInterestRate(0.10, 2_000_000, 0.80, 3.2, 12);
    // Expected: 0.10 + 0.003 + 0.020 + 0.013 + 0.0075 = 0.1435
    assertClose('high-risk rate', rate * 100, 14.35, 0.1);
  }

  // ── Test 5: Shark loan trigger ────────────────────────────────
  console.log('\nTest 5: Shark loan trigger');
  runLoanModule({
    teamNo: 0,
    decision: makeDecision(),
    existingLoans: [],
    financials: makeFinancials({ endcash: 200_000, cratio: 1.5, de: 0.5 }),
    gameaid: makeGameaid({ mincash: 500_000 }),
    forecast: makeForecast({ intrate: 0.10 }),
  })
    .then((result) => {
      // sharkLoan = 500K − 200K = 300K
      assertClose('sharkLoan', result.sharkLoan, 300_000, 1);
      // sharkInterest = 300K × 0.10 = 30K  (4×CIBOR / 4 = CIBOR)
      assertClose('sharkInterest', result.sharkInterest, 30_000, 1);
      // Should have 1 loan (the shark loan)
      console.log(`  Shark loan entries: ${result.updatedLoans.length}`);

      // ── Test 6: New loan issuance ─────────────────────────────
      console.log('\nTest 6: New 2YR loan of 1M');
      return runLoanModule({
        teamNo: 0,
        decision: makeDecision({ ntwLoan: 1_000_000 }),
        existingLoans: [],
        financials: makeFinancials({ endcash: 700_000, cratio: 1.875, de: 0.50 }),
        gameaid: makeGameaid(),
        forecast: makeForecast({ intrate: 0.10 }),
      });
    })
    .then((result) => {
      // Should have 1 new loan
      console.log(`  New loan entries: ${result.updatedLoans.length}`);
      const loan = result.updatedLoans[0];
      console.log(
        `  Loan: amount=${loan.lamount} dur=${loan.duration}Q ` +
          `qRate=${(loan.intrate * 100).toFixed(3)}% emi=${loan.emi.toFixed(2)}`,
      );
      // No shark loan expected
      assertClose('no shark', result.sharkLoan, 0, 0.01);

      // ── Test 7: Service existing + shark ──────────────────────
      console.log('\nTest 7: Service existing loan + shark trigger');
      const existingLoan: LoanEntry = {
        loanNo: 1,
        lamount: 1_000_000,
        intrate: 0.03, // 3% quarterly = ~12% annual
        duration: 8,
        amountdue: 800_000, // Some already repaid
        emi: 120_000,
        endsin: 6,
      };

      return runLoanModule({
        teamNo: 0,
        decision: makeDecision({ stl: 200_000 }),
        existingLoans: [existingLoan],
        financials: makeFinancials({ endcash: 300_000, cratio: 1.2, de: 1.5 }),
        gameaid: makeGameaid({ mincash: 500_000 }),
        forecast: makeForecast({ intrate: 0.10 }),
      });
    })
    .then((result) => {
      console.log(
        `  Total loans: ${result.updatedLoans.length} (existing + STL + shark)`,
      );
      console.log(
        `  totalInterest=${result.totalInterest.toFixed(2)} ` +
          `totalEMI=${result.totalEMI.toFixed(2)}`,
      );
      console.log(
        `  sharkLoan=${result.sharkLoan.toFixed(2)} ` +
          `sharkInterest=${result.sharkInterest.toFixed(2)}`,
      );

      // Shark loan should be 500K - 300K = 200K
      assertClose('shark (svc)', result.sharkLoan, 200_000, 1);
      // Shark interest = 200K × 0.10 = 20K
      assertClose('sharkInt (svc)', result.sharkInterest, 20_000, 1);

      console.log(
        '\n' + (allPass ? 'ALL CHECKS PASSED ✓' : 'SOME CHECKS FAILED ✗'),
      );
    })
    .catch((err) => {
      console.error('Test failed:', err);
      process.exit(1);
    });
}

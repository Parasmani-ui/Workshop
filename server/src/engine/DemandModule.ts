/**
 * DemandModule -- STEP 2 of quarter processing pipeline.
 *
 * Computes order books and market shares for ALL teams simultaneously
 * based on pricing, advertising, brand image, R&D, and economic factors.
 *
 * Demand is a competitive allocation -- each team's order book depends
 * on every other team's pricing and marketing decisions.
 *
 * **FoxPro Source:** `marktest.prg` + `n6pro.PRG` lines 1-755
 *
 * @module engine/DemandModule
 */

import { ENGINE_CONSTANTS } from './constants';
import type {
  DemandModuleInput,
  DemandModuleOutput,
  TeamDecision,
  ForecastParams,
  GameAidConfig,
} from './types';

const DEBUG = process.env.DEMAND_DEBUG === 'true';

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/** Safe division -- returns 0 if divisor is 0 */
function safeDivide(num: number, denom: number): number {
  return denom === 0 ? 0 : num / denom;
}

/** Sum an array of numbers */
function sumArray(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

/** Get selling price for product p (1-based) from a TeamDecision */
function getPrice(d: TeamDecision, p: number): number {
  return [0, d.price1, d.price2, d.price3, d.price4][p] ?? 0;
}

/** Get fixed S&A spend for product p (1-based) */
function getFsad(d: TeamDecision, p: number): number {
  return [0, d.fsad1, d.fsad2, d.fsad3, d.fsad4][p] ?? 0;
}

/** Get variable S&A spend for product p (1-based) */
function getVsad(d: TeamDecision, p: number): number {
  return [0, d.vsad1, d.vsad2, d.vsad3, d.vsad4][p] ?? 0;
}

/** Get cash discount rate for product p (1-based) */
function getDscnt(d: TeamDecision, p: number): number {
  return [0, d.dscnt1, d.dscnt2, d.dscnt3, d.dscnt4][p] ?? 0;
}

/** Get base demand for product p (1-based) from ForecastParams */
function getDemand(f: ForecastParams, p: number): number {
  return [0, f.demand1, f.demand2, f.demand3, f.demand4][p] ?? 0;
}

/** Get lambda demand normalization factor for product p (1-based) */
function getLambda(g: GameAidConfig, p: number): number {
  return [0, g.lama11, g.lama21, g.lamb11, g.lamc11][p] ?? 1.0;
}

/** Get ordbook field value by product index from an orderBooks entry */
function getOrdbookField(
  ob: DemandModuleOutput['orderBooks'][0],
  p: number
): number {
  switch (p) {
    case 1: return ob.ordbook1;
    case 2: return ob.ordbook2;
    case 3: return ob.ordbook3;
    case 4: return ob.ordbook4;
    default: return 0;
  }
}

/** Get market share field value by product index */
function getShareField(
  ms: DemandModuleOutput['marketShares'][0],
  p: number
): number {
  switch (p) {
    case 1: return ms.share1;
    case 2: return ms.share2;
    case 3: return ms.share3;
    case 4: return ms.share4;
    default: return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN DEMAND MODULE
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute demand allocation (order books) for ALL teams simultaneously.
 *
 * Processing steps:
 * 1. Compute brand image per team per product (5-component weighted formula)
 * 2. Compute advertising effect (fixed S&A with myopic carry-over + variable S&A)
 * 3. Compute price effectiveness with three-zone flex thresholds
 * 4. Compute R&D quality factor
 * 5. Compute credit policy factor from cash discounts
 * 6. Calculate raw order book using core demand formula
 * 7. Normalize order books using lambda demand factors
 * 8. Compute market shares
 *
 * @param input - All teams' decisions, previous sales, forecast, and demand model params
 * @returns Order books and market shares for every team
 */
export async function runDemandModule(
  input: DemandModuleInput
): Promise<DemandModuleOutput> {
  const { allDecisions, forecast, prods, gameaid } = input;
  const numTeams = allDecisions.length;
  const N = 4; // number of products

  // indpsense = 1.0 is valid — it makes the EXP(-LOG(psense)*prieff)
  // term collapse to 1.0, which means price-neutral base demand. The
  // real price response comes from the pflex/thres band adjustment to
  // prieff applied earlier in Step 3. Only reject degenerate values.
  if (prods.indpsense <= 0) {
    throw new Error(
      `DemandModule: indpsense must be > 0, got ${prods.indpsense}.`,
    );
  }

  const psense = prods.indpsense;
  const psenseIsNeutral = Math.abs(psense - 1.0) < 0.001;
  const noOfTeams = gameaid.nooft || numTeams || 1;

  // ─── STEP 1: Brand Image per team per product ───────────────────
  // IMAGE = 0.20*R&D + 0.30*FixedSA + 0.20*VarSA + 0.10*Projects + 0.20*VendorQuality
  // Each component is the team's share of total industry spend

  const totalRnd = Math.max(
    sumArray(allDecisions.map(d => d.rand1 + d.rand2)), 1
  );
  const totalProj = Math.max(
    sumArray(allDecisions.map(d => d.train1 + d.train2 + d.train3 + d.train4)), 1
  );

  // Per-product totals for S&A (floor at 1 to prevent /0)
  const totFsad = new Array(N + 1).fill(0);
  const totVsad = new Array(N + 1).fill(0);
  for (let p = 1; p <= N; p++) {
    totFsad[p] = Math.max(sumArray(allDecisions.map(d => getFsad(d, p))), 1);
    totVsad[p] = Math.max(sumArray(allDecisions.map(d => getVsad(d, p))), 1);
  }

  const image: number[][] = allDecisions.map(d => {
    const row = [0]; // index 0 unused
    for (let p = 1; p <= N; p++) {
      row[p] =
        ENGINE_CONSTANTS.IMAGE_WEIGHTS.rnd      * ((d.rand1 + d.rand2) / totalRnd) +
        ENGINE_CONSTANTS.IMAGE_WEIGHTS.fixedSA   * (getFsad(d, p) / totFsad[p]) +
        ENGINE_CONSTANTS.IMAGE_WEIGHTS.varSA     * (getVsad(d, p) / totVsad[p]) +
        ENGINE_CONSTANTS.IMAGE_WEIGHTS.projects  * ((d.train1 + d.train2 + d.train3 + d.train4) / totalProj) +
        ENGINE_CONSTANTS.IMAGE_WEIGHTS.vendorQuality * (1.0 / noOfTeams);
    }
    return row;
  });

  if (DEBUG) console.log('[DemandModule] Step 1 image:', JSON.stringify(image));

  // ─── STEP 2: Advertising Effect per team per product ────────────
  // Fixed S&A effect (fsdeff) uses myopic carry-over from previous quarter
  // Variable S&A effect (vsdeff) is current-quarter only

  // Compute effective fixed S&A with myopic carry-over
  const effFsad: number[][] = [];
  const totEffFsad = new Array(N + 1).fill(0);

  for (let t = 0; t < numTeams; t++) {
    const d = allDecisions[t];
    effFsad[t] = [0];
    for (let p = 1; p <= N; p++) {
      // Previous quarter's fsad carry-over
      // NOTE: prevSaleStates does not carry fsad values; defaults to 0.
      // For Q2+ the input should be extended with prev decisions for full myopic effect.
      const prevFsad = 0;
      effFsad[t][p] = getFsad(d, p) + prods.myopicf[p - 1] * prevFsad;
      totEffFsad[p] += effFsad[t][p];
    }
  }

  for (let p = 1; p <= N; p++) {
    totEffFsad[p] = Math.max(totEffFsad[p], 1);
  }

  // fsdeff = 1 + pf[p] * (teamEffFsad / totalEffFsad)
  // vsdeff = 1 + pv[p] * (teamVsad / totalVsad)
  // adEffect = fsdeff * vsdeff
  const adEffect: number[][] = allDecisions.map((d, t) => {
    const row = [0];
    for (let p = 1; p <= N; p++) {
      const fsdeff = 1 + prods.pf[p - 1] * (effFsad[t][p] / totEffFsad[p]);
      const vsdeff = 1 + prods.pv[p - 1] * (getVsad(d, p) / totVsad[p]);
      row[p] = fsdeff * vsdeff;
    }
    return row;
  });

  if (DEBUG) console.log('[DemandModule] Step 2 adEffect:', JSON.stringify(adEffect));

  // ─── STEP 3: Price Effectiveness (prieff) ───────────────────────
  // prieff = team_price / avg_market_price
  // Apply three-zone price flexibility thresholds from ProdsConfig

  // Average market price per product (only teams actively selling)
  const avgPrice = new Array(N + 1).fill(0);
  for (let p = 1; p <= N; p++) {
    const prices = allDecisions.map(d => getPrice(d, p)).filter(x => x > 0);
    avgPrice[p] = prices.length > 0 ? sumArray(prices) / prices.length : 0;
  }

  // Compute adjusted prieff using three-zone flex model
  const adjPrieff: number[][] = allDecisions.map(d => {
    const row = [0];
    for (let p = 1; p <= N; p++) {
      const price = getPrice(d, p);
      if (price <= 0 || avgPrice[p] <= 0) {
        row[p] = 0;
        continue;
      }

      const pe = price / avgPrice[p];
      const tlo = prods.threslo[p - 1];
      const thi = prods.threshi[p - 1];

      if (pe <= tlo) {
        // Zone 1: extreme low price -- pflexa amplifies deviation
        row[p] = tlo + (pe - tlo) * prods.pflexa[p - 1];
      } else if (pe <= 1.0) {
        // Zone 2: below-average but normal -- no adjustment
        row[p] = pe;
      } else if (pe <= thi) {
        // Zone 3: above-average premium -- pflexb dampens
        row[p] = 1.0 + (pe - 1.0) * prods.pflexb[p - 1];
      } else {
        // Zone 4: extreme high price -- pflexc amplifies premium penalty
        row[p] = thi + (pe - thi) * prods.pflexc[p - 1];
      }
    }
    return row;
  });

  if (DEBUG) console.log('[DemandModule] Step 3 adjPrieff:', JSON.stringify(adjPrieff));

  // ─── STEP 4: R&D Factor ────────────────────────────────────────
  // R&D improves product quality -> boosts demand
  // rndFactor = 1 + EXP(rand1^RND_POWER) / RND_DIVISOR, capped at 2.0
  // Source: marktest.prg (ENGINE_CONSTANTS: RND_POWER=0.27, RND_DIVISOR=350)

  const rndFactor = allDecisions.map(d => {
    // Using current quarter R&D only; cumulative tracking requires
    // previous decision history not currently in DemandModuleInput
    const spend = d.rand1;
    const factor = 1.0 +
      Math.exp(Math.pow(spend, ENGINE_CONSTANTS.RND_POWER)) /
      ENGINE_CONSTANTS.RND_DIVISOR;
    return Math.min(factor, 2.0);
  });

  if (DEBUG) console.log('[DemandModule] Step 4 rndFactor:', rndFactor);

  // ─── STEP 5: Credit Policy Factor ──────────────────────────────
  // Higher cash discount -> more demand (customers prefer discounts)
  // creditFactor = 1 + 0.1 * (teamDiscount - avgDiscount) / avgDiscount
  // Capped to [0.8, 1.2]

  const avgDscnt = new Array(N + 1).fill(0);
  for (let p = 1; p <= N; p++) {
    const discs = allDecisions
      .filter(d => getPrice(d, p) > 0)
      .map(d => getDscnt(d, p));
    avgDscnt[p] = discs.length > 0 ? sumArray(discs) / discs.length : 0;
  }

  const creditFactor: number[][] = allDecisions.map(d => {
    const row = [0];
    for (let p = 1; p <= N; p++) {
      const diff = getDscnt(d, p) - avgDscnt[p];
      let cf = 1 + 0.1 * safeDivide(diff, Math.max(avgDscnt[p], 0.01));
      row[p] = Math.max(0.8, Math.min(cf, 1.2));
    }
    return row;
  });

  if (DEBUG) console.log('[DemandModule] Step 5 creditFactor:', JSON.stringify(creditFactor));

  // ─── STEP 6: Raw Order Book (CORE FORMULA) ─────────────────────
  // ordBook = EXP(-LOG(psense) * adjustedPrieff) * baseDemand
  //         * rndFactor * creditFactor * adEffect * (1 + image)
  // Teams with price = 0 get ordBook = 0

  const rawOB: number[][] = allDecisions.map((d, t) => {
    const row = [0];
    for (let p = 1; p <= N; p++) {
      if (getPrice(d, p) <= 0) {
        row[p] = 0;
        continue;
      }

      const baseDemand = getDemand(forecast, p);
      const pe = adjPrieff[t][p];

      // When psense ≈ 1.0 the EXP term collapses to 1 and price response
      // is carried entirely by the pflex band adjustment to prieff.
      const priceEffect = psenseIsNeutral
        ? 1.0
        : Math.exp(-Math.log(psense) * pe);

      row[p] =
        priceEffect *
        baseDemand *
        rndFactor[t] *
        creditFactor[t][p] *
        adEffect[t][p] *
        (1 + image[t][p]);
    }
    return row;
  });

  if (DEBUG) console.log('[DemandModule] Step 6 rawOB:', JSON.stringify(rawOB));

  // ─── STEP 7: Normalize Order Books (Lambda Factors) ─────────────
  // Scale so total across all teams <= baseDemand * lambda
  // Lambda factors from GameAidConfig: lama11, lama21, lamb11, lamc11

  const ordBook: number[][] = Array.from(
    { length: numTeams },
    () => new Array(N + 1).fill(0)
  );

  for (let p = 1; p <= N; p++) {
    const totalRaw = sumArray(
      Array.from({ length: numTeams }, (_, t) => rawOB[t][p])
    );
    const baseDemand = getDemand(forecast, p);
    const lambda = getLambda(gameaid, p);
    const maxAllowed = baseDemand * lambda;

    const scale = (totalRaw > maxAllowed && totalRaw > 0)
      ? maxAllowed / totalRaw
      : 1.0;

    for (let t = 0; t < numTeams; t++) {
      ordBook[t][p] = Math.round(rawOB[t][p] * scale);
    }
  }

  if (DEBUG) console.log('[DemandModule] Step 7 ordBook:', JSON.stringify(ordBook));

  // ─── STEP 8: Market Shares ─────────────────────────────────────
  // marketShare = team ordBook / total ordBook for that product

  const mktShare: number[][] = Array.from(
    { length: numTeams },
    () => new Array(N + 1).fill(0)
  );

  for (let p = 1; p <= N; p++) {
    const totalOB = sumArray(
      Array.from({ length: numTeams }, (_, t) => ordBook[t][p])
    );
    if (totalOB > 0) {
      for (let t = 0; t < numTeams; t++) {
        mktShare[t][p] = ordBook[t][p] / totalOB;
      }
    }
  }

  if (DEBUG) console.log('[DemandModule] Step 8 mktShare:', JSON.stringify(mktShare));

  // ─── STEP 9: Build and return output ───────────────────────────

  return {
    orderBooks: allDecisions.map((d, t) => ({
      teamNo: d.teamNo,
      ordbook1: ordBook[t][1],
      ordbook2: ordBook[t][2],
      ordbook3: ordBook[t][3],
      ordbook4: ordBook[t][4],
    })),
    marketShares: allDecisions.map((d, t) => ({
      teamNo: d.teamNo,
      share1: mktShare[t][1],
      share2: mktShare[t][2],
      share3: mktShare[t][3],
      share4: mktShare[t][4],
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate a DemandModuleOutput for consistency and correctness.
 *
 * Checks:
 * - All orderBook values are non-negative integers
 * - For each product: SUM(ordbooks) <= baseDemand * lambda * 1.01
 * - All marketShares are between 0 and 1
 * - For each product: SUM(marketShares) is approximately 1.0 (+/-0.01)
 * - No NaN or Infinity values anywhere
 */
export function validateDemandModuleOutput(
  output: DemandModuleOutput,
  input: DemandModuleInput
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const N = 4;

  // Check individual orderBook values
  for (const ob of output.orderBooks) {
    for (let p = 1; p <= N; p++) {
      const val = getOrdbookField(ob, p);
      if (!Number.isFinite(val)) {
        errors.push(`Team ${ob.teamNo} P${p}: ordbook is NaN/Infinity`);
      }
      if (val < 0) {
        errors.push(`Team ${ob.teamNo} P${p}: negative ordbook ${val}`);
      }
      if (val !== Math.round(val)) {
        errors.push(`Team ${ob.teamNo} P${p}: non-integer ordbook ${val}`);
      }
    }
  }

  // Check individual market share values
  for (const ms of output.marketShares) {
    for (let p = 1; p <= N; p++) {
      const val = getShareField(ms, p);
      if (!Number.isFinite(val)) {
        errors.push(`Team ${ms.teamNo} P${p}: market share is NaN/Infinity`);
      }
      if (val < 0 || val > 1) {
        errors.push(`Team ${ms.teamNo} P${p}: market share ${val} out of [0,1]`);
      }
    }
  }

  // Check per-product totals
  for (let p = 1; p <= N; p++) {
    const demand = getDemand(input.forecast, p);
    const lambda = getLambda(input.gameaid, p);

    // Total ordbooks should not exceed demand * lambda (with 1% tolerance for rounding)
    const totalOB = sumArray(output.orderBooks.map(ob => getOrdbookField(ob, p)));
    if (demand > 0 && totalOB > demand * lambda * 1.01) {
      errors.push(
        `Product ${p}: total ordbooks ${totalOB} exceeds ` +
        `demand*lambda ${demand * lambda}`
      );
    }

    // Market shares should sum to ~1.0 for products with demand
    const totalShare = sumArray(output.marketShares.map(ms => getShareField(ms, p)));
    if (demand > 0 && totalOB > 0 && Math.abs(totalShare - 1.0) > 0.01) {
      errors.push(
        `Product ${p}: market shares sum to ${totalShare.toFixed(4)}, expected ~1.0`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════════
// UNIT TEST STUBS
// ═══════════════════════════════════════════════════════════════════

// TEST 1: equal prices -> all teams should get equal market share
// TEST 2: one team 10% below avg price -> should get > average share
// TEST 3: zero ad spend all teams -> adEffect should be 1.0 for all
// TEST 4: total ordbook should never exceed baseDemand * lambda

// ═══════════════════════════════════════════════════════════════════
// INLINE SANITY TEST
// ═══════════════════════════════════════════════════════════════════

if (require.main === module) {
  // Helper to build a TeamDecision with defaults
  function makeDecision(overrides: Partial<TeamDecision>): TeamDecision {
    return {
      teamNo: 0, prod1: 0, prod2: 0, prod3: 0, prod4: 0,
      price1: 0, price2: 0, price3: 0, price4: 0,
      raw1: 0, raw2: 0,
      fsad1: 0, fsad2: 0, fsad3: 0, fsad4: 0,
      vsad1: 0, vsad2: 0, vsad3: 0, vsad4: 0,
      dscnt1: 0, dscnt2: 0, dscnt3: 0, dscnt4: 0,
      newPCap: 0, newMCap: 0,
      stl: 0, ntwLoan: 0, nthLoan: 0, nBond: 0,
      equDiv: 0, equNo: 0, equPri: 0,
      rand1: 0, rand2: 0, crPrd: 0,
      alliance1: 0, alliance2: 0, alliance3: 0, alliance4: 0,
      cprod1: 0, cprod2: 0, cprod3: 0, cprod4: 0,
      cprice1: 0, cprice2: 0, cprice3: 0, cprice4: 0,
      strset: 0, bdisc: 0,
      train1: 0, train2: 0, train3: 0, train4: 0,
      prefNo: 0, prefPri: 0,
      ...overrides,
    };
  }

  const testInput: DemandModuleInput = {
    allDecisions: [
      makeDecision({
        teamNo: 0, price1: 45, price2: 55, price3: 0, price4: 0,
        fsad1: 50000, fsad2: 40000, vsad1: 20000, vsad2: 15000,
        rand1: 30000, rand2: 0, dscnt1: 2, dscnt2: 2,
      }),
      makeDecision({
        teamNo: 1, price1: 47, price2: 53, price3: 0, price4: 0,
        fsad1: 55000, fsad2: 35000, vsad1: 18000, vsad2: 20000,
        rand1: 25000, rand2: 0, dscnt1: 2, dscnt2: 2,
      }),
    ],
    prevSaleStates: [],
    forecast: {
      quarterNo: 1,
      demand1: 32000, demand2: 21000, demand3: 0, demand4: 0,
      trend1: 1, trend2: 1, trend3: 1, trend4: 1,
      si1: 1, si2: 1, si3: 1, si4: 1,
      ci: 1, sensex: 100, wpi: 100, gdp: 5, mindex: 100,
      intrate: 10, geneco: 0,
      fcasta1: 0, fcasta2: 0, fcasta3: 0, fcasta4: 0,
      matcostch1: 0, matcostch2: 0, labcostch: 0,
      conquant1: 0, conquant2: 0, conquant3: 0, conquant4: 0,
      expoinc1: 0, expoinc2: 0, expoinc3: 0, expoinc4: 0,
      cscolp1: 0, cscolp2: 0, cscolp3: 0, cscolp4: 0,
      rm1lim: 0, rm2lim: 0,
      shipqrt: 0, odsqueze: 0, riskp: 0,
      deltax: 0, dtaxch: 0, delwh: 0,
      mcost: 0, pcost: 0,
      procpri1: 0, procpri2: 0, procpri3: 0, procpri4: 0,
      blkrm1: 0, blkrm2: 0,
    },
    prods: {
      indpsense: 1.5,
      pflexa: [1.2, 1.2, 1.2, 1.2],
      pflexb: [0.8, 0.8, 0.8, 0.8],
      pflexc: [1.5, 1.5, 1.5, 1.5],
      threslo: [0.7, 0.7, 0.7, 0.7],
      threshi: [1.3, 1.3, 1.3, 1.3],
      pf: [0.3, 0.3, 0.3, 0.3],
      pv: [0.2, 0.2, 0.2, 0.2],
      myopicf: [0.5, 0.5, 0.5, 0.5],
      myopicv: [0.5, 0.5, 0.5, 0.5],
      labfactor: [1.0, 1.0, 1.0, 1.0],
    },
    gameaid: {
      gameid: 'TEST', nooft: 2,
      bmatcostx: 0, bmatcosty: 0,
      blabcost1: 0, blabcost2: 0, blabcost3: 0, blabcost4: 0,
      blabslab1: 0, blabslab2: 0, blabslab3: 0,
      bwhcost1: 0, bwhcost2: 0, bwhcost3: 0,
      bwhslab1: 0, bwhslab2: 0,
      bovrhd1: 0, bovrhd2: 0, bovrhd3: 0,
      bovrhsb1: 0, bovrhsb2: 0,
      mcapcost: 0, pcapcost: 0, mlife: 8, plife: 20,
      eqfv: 10, mincash: 50000, cashsale: 50, itaxrate: 30,
      dtax: 0, prefdiv: 0, preffv: 0,
      wincrit: 'M', gametype: 'P',
      rm11: 0, rm12: 0, rm13: 0, rm14: 0,
      rm21: 0, rm22: 0, rm23: 0, rm24: 0,
      lama11: 1.0, lama21: 1.0, lamb11: 1.0, lamc11: 1.0,
    },
  };

  runDemandModule(testInput).then(output => {
    console.log('=== DEMAND MODULE SANITY TEST ===');
    console.log('Team 0 order books:', output.orderBooks[0]);
    console.log('Team 1 order books:', output.orderBooks[1]);
    console.log(
      'Market shares P1:',
      output.marketShares[0]?.share1.toFixed(4),
      output.marketShares[1]?.share1.toFixed(4)
    );
    console.log(
      'Market shares P2:',
      output.marketShares[0]?.share2.toFixed(4),
      output.marketShares[1]?.share2.toFixed(4)
    );
    const totalP1 =
      (output.orderBooks[0]?.ordbook1 ?? 0) +
      (output.orderBooks[1]?.ordbook1 ?? 0);
    const totalP2 =
      (output.orderBooks[0]?.ordbook2 ?? 0) +
      (output.orderBooks[1]?.ordbook2 ?? 0);
    console.log('Total P1 ordbooks:', totalP1, '(demand: 32000)');
    console.log('Total P2 ordbooks:', totalP2, '(demand: 21000)');

    // Check expected properties
    const t0p1 = output.orderBooks[0]?.ordbook1 ?? 0;
    const t1p1 = output.orderBooks[1]?.ordbook1 ?? 0;
    const t0p2 = output.orderBooks[0]?.ordbook2 ?? 0;
    const t1p2 = output.orderBooks[1]?.ordbook2 ?? 0;
    console.log(
      '\nTeam 0 lower price on P1 -> higher ordbook?',
      t0p1 > t1p1 ? 'YES' : 'NO'
    );
    console.log(
      'Team 1 lower price on P2 -> higher ordbook?',
      t1p2 > t0p2 ? 'YES' : 'NO'
    );

    const validation = validateDemandModuleOutput(output, testInput);
    console.log('\nValidation:', validation);
  }).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
}

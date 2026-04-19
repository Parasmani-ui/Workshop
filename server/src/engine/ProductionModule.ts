/**
 * ProductionModule — STEP 3 of quarter processing pipeline.
 *
 * Determines actual production per product, constrained by capacity
 * and raw material availability. Manages RM purchasing, consumption,
 * finished-goods inventory, and actual sales using ACP valuation.
 *
 * **FoxPro Source:** `n6pro.PRG` — production section
 *
 * @module engine/ProductionModule
 */

import type {
  ProductionModuleInput,
  ProductionModuleOutput,
  ProductionTeamResult,
  TeamDecision,
  SaleState,
  GameAidConfig,
  ForecastParams,
  DemandModuleOutput,
} from './types';

const DEBUG = process.env.PROD_DEBUG === 'true';

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Safe division — returns 0 if divisor is 0 */
function safeDivide(num: number, denom: number): number {
  return denom === 0 ? 0 : num / denom;
}

/** Get RM1 consumption per unit for product p (0-based index) */
function getRM1PerUnit(g: GameAidConfig, p: number): number {
  return [g.rm11, g.rm12, g.rm13, g.rm14][p] ?? 0;
}

/** Get RM2 consumption per unit for product p (0-based index) */
function getRM2PerUnit(g: GameAidConfig, p: number): number {
  return [g.rm21, g.rm22, g.rm23, g.rm24][p] ?? 0;
}

/** Get decided production for product p (0-based) from TeamDecision */
function getProd(d: TeamDecision, p: number): number {
  return [d.prod1, d.prod2, d.prod3, d.prod4][p] ?? 0;
}

/** Get closing FG inventory for product p (0-based) from SaleState */
function getClosingInv(s: SaleState, p: number): number {
  return [s.closeinv1, s.closeinv2, s.closeinv3, s.closeinv4][p] ?? 0;
}

/** Get order book for product p (0-based) from DemandModuleOutput entry */
function getOrdbook(
  ob: DemandModuleOutput['orderBooks'][0],
  p: number,
): number {
  return [ob.ordbook1, ob.ordbook2, ob.ordbook3, ob.ordbook4][p] ?? 0;
}

/** Get outsourced (contract) production for product p (0-based) */
function getCprod(d: TeamDecision, p: number): number {
  return [d.cprod1, d.cprod2, d.cprod3, d.cprod4][p] ?? 0;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN — runProductionModule
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute production, RM consumption, inventory, and sales for ALL teams.
 *
 * Processing steps per team:
 * 1. Determine usable capacity = MIN(placap, maccap)
 * 2. Constrain decided production to usable capacity (scale proportionally)
 * 3. RM availability check with STRICT PRECEDENCE P1 → P2 → P3 → P4
 * 4. Contract manufacturing (outsourced units from cprod1..4)
 * 5. Sales = MIN(available, orderBook); closing FG = available − sales
 * 6. RM weighted average cost (WAX, WAY) using ACP method
 *
 * @param input — Batch input: all decisions, demand output, capacities, prev state, config
 * @returns Array of per-team production results
 */
export async function runProductionModule(
  input: ProductionModuleInput,
): Promise<ProductionModuleOutput> {
  const {
    decisions,
    demandOutput,
    capacityStates,
    prevSaleStates,
    forecast,
    gameaid,
  } = input;
  const results: ProductionTeamResult[] = [];

  for (const decision of decisions) {
    const t = decision.teamNo;
    const capState = capacityStates.find(c => c.teamNo === t);
    const prevSale = prevSaleStates.find(s => s.teamNo === t);
    const orderBookEntry = demandOutput.orderBooks.find(ob => ob.teamNo === t);

    // Defaults for missing state (Q1 or team not found)
    const maccap = capState?.maccap ?? 0;
    const placap = capState?.placap ?? 0;

    // ── STEP 1: Usable capacity ──────────────────────────────────
    // Both plant AND machine must be available; if either is 0, production = 0
    const usableCap = Math.min(maccap, placap);

    if (DEBUG) {
      console.log(
        `[ProductionModule] Team ${t}: usableCap=${usableCap} ` +
          `(mac=${maccap}, pla=${placap})`,
      );
    }

    // ── STEP 2: Constrain decided production to capacity ─────────
    const decided: [number, number, number, number] = [
      getProd(decision, 0),
      getProd(decision, 1),
      getProd(decision, 2),
      getProd(decision, 3),
    ];
    const decidedTotal = decided[0] + decided[1] + decided[2] + decided[3];

    const actualProd: [number, number, number, number] = [0, 0, 0, 0];
    if (decidedTotal > usableCap && decidedTotal > 0) {
      const scale = safeDivide(usableCap, decidedTotal);
      for (let p = 0; p < 4; p++) {
        actualProd[p] = Math.floor(decided[p] * scale);
      }
    } else {
      for (let p = 0; p < 4; p++) {
        actualProd[p] = decided[p];
      }
    }

    if (DEBUG) {
      console.log(
        `[ProductionModule] Team ${t}: actualProd after cap constraint:`,
        actualProd,
      );
    }

    // ── STEP 3: RM availability check (PRECEDENCE P1→P2→P3→P4) ──
    const openRM1 = prevSale?.crawin1 ?? 0;
    const openRM2 = prevSale?.crawin2 ?? 0;

    // RM purchase constraint:
    // max_purchase = prev_purchase × (1 + rm_limit%)
    // When there's no prior purchase history (Q1 bootstrap, or a team
    // that sat out a quarter), apply no constraint — a prev value of 0
    // must NOT collapse the allowance to 0. We intentionally use > 0
    // rather than nullish-coalescing so the Q0 bootstrap state (which
    // populates prevSale.rawx = 0 from schema defaults) doesn't trip it.
    const prevRaw1 = prevSale?.rawx ?? 0;
    const prevRaw2 = prevSale?.rawy ?? 0;
    const maxRaw1Purchase =
      prevRaw1 > 0 ? prevRaw1 * (1 + forecast.rm1lim) : Infinity;
    const maxRaw2Purchase =
      prevRaw2 > 0 ? prevRaw2 * (1 + forecast.rm2lim) : Infinity;
    const actualRaw1Purchase = Math.min(decision.raw1, maxRaw1Purchase);
    const actualRaw2Purchase = Math.min(decision.raw2, maxRaw2Purchase);

    const availRM1 = openRM1 + actualRaw1Purchase;
    const availRM2 = openRM2 + actualRaw2Purchase;

    if (DEBUG) {
      console.log(
        `[ProductionModule] Team ${t}: openRM=[${openRM1}, ${openRM2}] ` +
          `purchased=[${actualRaw1Purchase}, ${actualRaw2Purchase}] ` +
          `avail=[${availRM1}, ${availRM2}]`,
      );
    }

    // Allocate RM with STRICT PRECEDENCE: P1 gets RM first, then P2, P3, P4
    let remainRM1 = availRM1;
    let remainRM2 = availRM2;
    const finalProd: [number, number, number, number] = [0, 0, 0, 0];

    for (let p = 0; p < 4; p++) {
      const rm1PerUnit = getRM1PerUnit(gameaid, p);
      const rm2PerUnit = getRM2PerUnit(gameaid, p);
      const needed1 = actualProd[p] * rm1PerUnit;
      const needed2 = actualProd[p] * rm2PerUnit;

      if (needed1 <= remainRM1 && needed2 <= remainRM2) {
        // Full production possible for this product
        finalProd[p] = actualProd[p];
        remainRM1 -= needed1;
        remainRM2 -= needed2;
      } else {
        // Reduce production to what RM allows
        const maxByRM1 =
          rm1PerUnit > 0
            ? Math.floor(safeDivide(remainRM1, rm1PerUnit))
            : actualProd[p];
        const maxByRM2 =
          rm2PerUnit > 0
            ? Math.floor(safeDivide(remainRM2, rm2PerUnit))
            : actualProd[p];
        finalProd[p] = Math.min(actualProd[p], maxByRM1, maxByRM2);
        remainRM1 -= finalProd[p] * rm1PerUnit;
        remainRM2 -= finalProd[p] * rm2PerUnit;
      }
    }

    const rmConsumed1 = availRM1 - remainRM1;
    const rmConsumed2 = availRM2 - remainRM2;
    const closingRM1 = remainRM1;
    const closingRM2 = remainRM2;

    if (DEBUG) {
      console.log(
        `[ProductionModule] Team ${t}: finalProd:`,
        finalProd,
        `rmConsumed=[${rmConsumed1}, ${rmConsumed2}] ` +
          `closingRM=[${closingRM1}, ${closingRM2}]`,
      );
    }

    // ── STEP 4: Contract manufacturing (outsourced units) ────────
    const outsourced: [number, number, number, number] = [
      getCprod(decision, 0),
      getCprod(decision, 1),
      getCprod(decision, 2),
      getCprod(decision, 3),
    ];

    // ── STEP 5: Sales and closing FG inventory ───────────────────
    const openFG: [number, number, number, number] = [
      prevSale ? getClosingInv(prevSale, 0) : 0,
      prevSale ? getClosingInv(prevSale, 1) : 0,
      prevSale ? getClosingInv(prevSale, 2) : 0,
      prevSale ? getClosingInv(prevSale, 3) : 0,
    ];

    const actualSales: [number, number, number, number] = [0, 0, 0, 0];
    const closingFG: [number, number, number, number] = [0, 0, 0, 0];
    const ownClosingFG: [number, number, number, number] = [0, 0, 0, 0];

    for (let p = 0; p < 4; p++) {
      // FoxPro model: opening FG inventory flows through COGS as a book-value
      // entry (openinv in PANDL) but is NOT physically available-for-sale.
      // Only new production + outsourced units can be sold this quarter.
      // This matches the golden data where closeinv = prod - sales (not prod + opening - sales).
      const availableForSale = finalProd[p] + outsourced[p];
      const ordBook = orderBookEntry ? getOrdbook(orderBookEntry, p) : 0;
      actualSales[p] = Math.min(availableForSale, ordBook);
      closingFG[p] = availableForSale - actualSales[p];
      // ownClosingFG: own-produced units not sold (own production fills demand first).
      // Outsourced units are excluded from P&L closing inventory valuation.
      ownClosingFG[p] = Math.max(0, finalProd[p] - Math.min(finalProd[p], actualSales[p]));
    }

    if (DEBUG) {
      console.log(
        `[ProductionModule] Team ${t}: sales:`,
        actualSales,
        `closingFG:`,
        closingFG,
      );
    }

    // ── STEP 6: RM weighted average cost (WAX, WAY) ─────────────
    // ACP method: WAX = (openValue + purchaseValue) / totalUnits
    const prevWax = prevSale?.wax ?? gameaid.bmatcostx;
    const prevWay = prevSale?.way ?? gameaid.bmatcosty;
    // Legacy FORECAST.matcostch is stored as an absolute Rs-per-unit delta
    // applied to the GAMEAID base price, not a growth percent. Verified
    // against MPA-iipm Q1: bmatcostx=75, matcostch1=1 → real rawxpri=76.
    const currentRM1Price = gameaid.bmatcostx + forecast.matcostch1;
    const currentRM2Price = gameaid.bmatcosty + forecast.matcostch2;

    const totalRM1units = openRM1 + actualRaw1Purchase;
    const totalRM2units = openRM2 + actualRaw2Purchase;

    const wax =
      totalRM1units > 0
        ? safeDivide(
            openRM1 * prevWax + actualRaw1Purchase * currentRM1Price,
            totalRM1units,
          )
        : currentRM1Price;
    const way =
      totalRM2units > 0
        ? safeDivide(
            openRM2 * prevWay + actualRaw2Purchase * currentRM2Price,
            totalRM2units,
          )
        : currentRM2Price;

    if (DEBUG) {
      console.log(
        `[ProductionModule] Team ${t}: wax=${wax.toFixed(2)}, way=${way.toFixed(2)}`,
      );
    }

    results.push({
      teamNo: t,
      finalProd,
      actualSales,
      closingFG,
      ownClosingFG,
      openFG,
      outsourced,
      rmPurchased: [actualRaw1Purchase, actualRaw2Purchase],
      rmConsumed: [rmConsumed1, rmConsumed2],
      closingRM: [closingRM1, closingRM2],
      wax,
      way,
      currentRM1Price,
      currentRM2Price,
      usableCap,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════
// INLINE SANITY TEST
// ═══════════════════════════════════════════════════════════════════

if (require.main === module) {
  /* eslint-disable @typescript-eslint/no-require-imports */
  function makeDecision(overrides: Partial<TeamDecision>): TeamDecision {
    return {
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

  // 2 teams, 2 products (P1, P2)
  // Team 0: cap=30000, produces 15000 P1 + 10000 P2, RM1 ratio=2, RM2 ratio=1
  // Team 1: cap=20000, produces 12000 P1 + 8000 P2, RM1 ratio=2, RM2 ratio=1
  const testDecisions: TeamDecision[] = [
    makeDecision({
      teamNo: 0,
      prod1: 15000, prod2: 10000, prod3: 0, prod4: 0,
      price1: 45, price2: 55,
      raw1: 60000, raw2: 30000,  // RM1 need: (15k+10k)×2=50k, RM2: (15k+10k)×1=25k
    }),
    makeDecision({
      teamNo: 1,
      prod1: 12000, prod2: 8000, prod3: 0, prod4: 0,
      price1: 47, price2: 53,
      raw1: 50000, raw2: 25000,  // RM1 need: (12k+8k)×2=40k, RM2: (12k+8k)×1=20k
    }),
  ];

  const testDemandOutput: import('./types').DemandModuleOutput = {
    orderBooks: [
      { teamNo: 0, ordbook1: 14000, ordbook2: 9000, ordbook3: 0, ordbook4: 0 },
      { teamNo: 1, ordbook1: 11000, ordbook2: 7000, ordbook3: 0, ordbook4: 0 },
    ],
    marketShares: [
      { teamNo: 0, share1: 0.56, share2: 0.56, share3: 0, share4: 0 },
      { teamNo: 1, share1: 0.44, share2: 0.44, share3: 0, share4: 0 },
    ],
  };

  const testInput: import('./types').ProductionModuleInput = {
    decisions: testDecisions,
    demandOutput: testDemandOutput,
    capacityStates: [
      { teamNo: 0, maccap: 30000, placap: 30000, newmcap: 0, newpcap: 0, deprecm: 0, deprecp: 0 },
      { teamNo: 1, maccap: 20000, placap: 25000, newmcap: 0, newpcap: 0, deprecm: 0, deprecp: 0 },
    ],
    prevSaleStates: [],  // Q1: no previous state
    forecast: {
      quarterNo: 1,
      trend1: 1, trend2: 1, trend3: 1, trend4: 1,
      si1: 1, si2: 1, si3: 1, si4: 1,
      ci: 1, sensex: 100, wpi: 100, gdp: 5, mindex: 100,
      intrate: 10, geneco: 0,
      fcasta1: 0, fcasta2: 0, fcasta3: 0, fcasta4: 0,
      demand1: 32000, demand2: 21000, demand3: 0, demand4: 0,
      matcostch1: 0.05, matcostch2: 0.03,   // 5% and 3% RM cost increase
      labcostch: 0,
      conquant1: 0, conquant2: 0, conquant3: 0, conquant4: 0,
      expoinc1: 0, expoinc2: 0, expoinc3: 0, expoinc4: 0,
      cscolp1: 0, cscolp2: 0, cscolp3: 0, cscolp4: 0,
      rm1lim: 0.5, rm2lim: 0.5,   // 50% purchase deviation allowed
      shipqrt: 0, odsqueze: 0, riskp: 0,
      deltax: 0, dtaxch: 0, delwh: 0,
      mcost: 0, pcost: 0,
      procpri1: 0, procpri2: 0, procpri3: 0, procpri4: 0,
      blkrm1: 0, blkrm2: 0,
    },
    gameaid: {
      gameid: 'TEST', nooft: 2,
      bmatcostx: 10, bmatcosty: 8,
      blabcost1: 10, blabcost2: 12, blabcost3: 15, blabcost4: 18,
      blabslab1: 20000, blabslab2: 30000, blabslab3: 50000,
      bwhcost1: 2, bwhcost2: 3, bwhcost3: 4,
      bwhslab1: 20000, bwhslab2: 40000,
      bovrhd1: 5, bovrhd2: 6, bovrhd3: 7,
      bovrhsb1: 30000, bovrhsb2: 60000,
      mcapcost: 100, pcapcost: 200, mlife: 8, plife: 20,
      eqfv: 10, mincash: 50000, cashsale: 50, itaxrate: 30,
      dtax: 0, prefdiv: 0, preffv: 0,
      wincrit: 'M', gametype: 'P',
      rm11: 2, rm12: 2, rm13: 0, rm14: 0,   // RM1 per unit: 2 for P1, 2 for P2
      rm21: 1, rm22: 1, rm23: 0, rm24: 0,   // RM2 per unit: 1 for P1, 1 for P2
      lama11: 1.0, lama21: 1.0, lamb11: 1.0, lamc11: 1.0,
    },
  };

  runProductionModule(testInput)
    .then(output => {
      console.log('=== PRODUCTION MODULE SANITY TEST ===');
      let allPass = true;

      for (const team of output) {
        console.log(`\nTeam ${team.teamNo}:`);
        console.log('  finalProd:', team.finalProd);
        console.log('  actualSales:', team.actualSales);
        console.log('  closingFG:', team.closingFG);
        console.log('  rmConsumed:', team.rmConsumed);
        console.log('  closingRM:', team.closingRM);
        console.log('  wax:', team.wax.toFixed(2), 'way:', team.way.toFixed(2));
        console.log('  usableCap:', team.usableCap);

        // CHECK 1: actualSales <= ordBook for each product
        const ob = testDemandOutput.orderBooks.find(o => o.teamNo === team.teamNo);
        if (ob) {
          for (let p = 0; p < 4; p++) {
            const ordVal = [ob.ordbook1, ob.ordbook2, ob.ordbook3, ob.ordbook4][p];
            if (team.actualSales[p] > ordVal) {
              console.error(`  FAIL: sales[${p}]=${team.actualSales[p]} > ordBook=${ordVal}`);
              allPass = false;
            }
          }
        }

        // CHECK 2: closingFG >= 0
        for (let p = 0; p < 4; p++) {
          if (team.closingFG[p] < 0) {
            console.error(`  FAIL: closingFG[${p}]=${team.closingFG[p]} < 0`);
            allPass = false;
          }
        }

        // CHECK 3: RM consumption <= available RM
        const availRM1 = team.rmConsumed[0] + team.closingRM[0];
        const rmUsed1 =
          team.finalProd[0] * testInput.gameaid.rm11 +
          team.finalProd[1] * testInput.gameaid.rm12 +
          team.finalProd[2] * testInput.gameaid.rm13 +
          team.finalProd[3] * testInput.gameaid.rm14;
        if (Math.abs(rmUsed1 - team.rmConsumed[0]) > 0.01) {
          console.error(
            `  FAIL: SUM(finalProd × rm1_ratio)=${rmUsed1} != rmConsumed[0]=${team.rmConsumed[0]}`,
          );
          allPass = false;
        }
      }

      console.log('\n' + (allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
    })
    .catch(err => {
      console.error('Test failed:', err);
      process.exit(1);
    });
}

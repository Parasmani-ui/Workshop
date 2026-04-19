/**
 * CostModule — STEP 4 of quarter processing pipeline.
 *
 * Computes all production and operational costs: material, labour,
 * warehousing, and overhead. Uses slab-based costing from GAMEAID
 * configuration.
 *
 * **FoxPro Source:** `n6pro.PRG` — OPTABLE computation section
 *
 * @module engine/CostModule
 */

import type {
  CostModuleInput,
  CostModuleOutput,
  CostTeamResult,
  ProductionTeamResult,
  TeamDecision,
  SaleState,
  GameAidConfig,
  ForecastParams,
} from './types';

const DEBUG = process.env.COST_DEBUG === 'true';

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Safe division — returns 0 if divisor is 0 */
function safeDivide(num: number, denom: number): number {
  return denom === 0 ? 0 : num / denom;
}

/** Get procurement price for product p (0-based) from ForecastParams */
function getProcPri(f: ForecastParams, p: number): number {
  return [f.procpri1, f.procpri2, f.procpri3, f.procpri4][p] ?? 0;
}

/** Get fixed S&A for product p (0-based) from TeamDecision */
function getFsad(d: TeamDecision, p: number): number {
  return [d.fsad1, d.fsad2, d.fsad3, d.fsad4][p] ?? 0;
}

/** Get variable S&A for product p (0-based) from TeamDecision */
function getVsad(d: TeamDecision, p: number): number {
  return [d.vsad1, d.vsad2, d.vsad3, d.vsad4][p] ?? 0;
}

/** Get ACP for product p (0-based) from SaleState */
function getAcp(s: SaleState, p: number): number {
  return [s.acp1, s.acp2, s.acp3, s.acp4][p] ?? 0;
}

// ═══════════════════════════════════════════════════════════════════
// SLAB CALCULATION HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * INCREMENTAL slab calculation.
 *
 * Each unit is charged at the rate of the slab it falls into.
 * E.g., with slabs [0–20K @10, 20K–30K @12, 30K–50K @15, 50K+ @18]:
 *   25000 units → 20000×10 + 5000×12 = 260000
 *
 * This is fundamentally different from PURE slab (see below).
 */
function incrementalSlab(
  quantity: number,
  slabs: { limit: number; rate: number }[],
): number {
  let cost = 0;
  let remaining = quantity;
  let prevLimit = 0;

  for (const slab of slabs) {
    const slabWidth = slab.limit - prevLimit;
    const unitsInSlab = Math.min(remaining, slabWidth);
    if (unitsInSlab <= 0) break;
    cost += unitsInSlab * slab.rate;
    remaining -= unitsInSlab;
    prevLimit = slab.limit;
    if (remaining <= 0) break;
  }

  return cost;
}

/**
 * PURE slab calculation.
 *
 * ALL units are charged at the rate of whichever slab the TOTAL falls into.
 * E.g., with slabs [0–20K @2, 20K–40K @3, 40K+ @4]:
 *   25000 units → 25000×3 = 75000 (all at slab 2 rate)
 *
 * This is fundamentally different from incremental slab.
 */
function pureSlab(
  quantity: number,
  slabs: { limit: number; rate: number }[],
): number {
  for (const slab of slabs) {
    if (quantity <= slab.limit) {
      return quantity * slab.rate;
    }
  }
  // Quantity exceeds all slab limits — use the last slab rate
  const lastRate = slabs[slabs.length - 1]?.rate ?? 0;
  return quantity * lastRate;
}

/**
 * FLAT slab lookup.
 *
 * Returns a flat band amount (NOT multiplied by quantity) for the first
 * slab where `value <= slab.limit`. Used for production overhead where
 * GAMEAID.bovrhd1/2/3 store the total cost for each capacity band, not
 * a per-unit rate. Source: btrep1.PRG / n5pro.PRG overhead lookup.
 */
function flatSlabLookup(
  value: number,
  slabs: { limit: number; amount: number }[],
): number {
  for (const slab of slabs) {
    if (value <= slab.limit) return slab.amount;
  }
  return slabs[slabs.length - 1]?.amount ?? 0;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN — runCostModule
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute all cost components for ALL teams' quarter.
 *
 * Processing steps per team:
 * 1. Direct material cost = RM consumed × WAX/WAY + outsourcing cost
 * 2. Direct labour cost = INCREMENTAL slab on total production (4 slabs)
 * 3. Warehouse/godown cost = PURE slab on total closing inventory (3 slabs)
 * 4. Production overhead = PURE slab on MAX(placap, maccap) (3 slabs)
 * 5. S&A expenses = SUM(fsad + vsad) across products
 * 6. R&D expense = rand1 + rand2
 * 7. ACP per product = (openingValue + productionValue) / (openingUnits + producedUnits)
 *
 * @param input — Batch input: production outputs, decisions, capacities, prev state, config
 * @returns Array of per-team cost results
 */
export async function runCostModule(
  input: CostModuleInput,
): Promise<CostModuleOutput> {
  const {
    productionOutputs,
    decisions,
    capacityStates,
    prevSaleStates,
    gameaid,
    forecast,
  } = input;
  const results: CostTeamResult[] = [];

  for (const prodOut of productionOutputs) {
    const t = prodOut.teamNo;
    const decision = decisions.find(d => d.teamNo === t);
    if (!decision) {
      throw new Error(`CostModule: no decision found for team ${t}`);
    }
    const capState = capacityStates.find(c => c.teamNo === t);
    const prevSale = prevSaleStates.find(s => s.teamNo === t);

    // ── STEP 1: Direct Material Cost ─────────────────────────────
    const materialCost =
      prodOut.rmConsumed[0] * prodOut.wax +
      prodOut.rmConsumed[1] * prodOut.way;

    let outsourceCost = 0;
    for (let p = 0; p < 4; p++) {
      outsourceCost += prodOut.outsourced[p] * getProcPri(forecast, p);
    }
    const totalMaterialCost = materialCost + outsourceCost;

    if (DEBUG) {
      console.log(
        `[CostModule] Team ${t}: materialCost=${materialCost.toFixed(2)} ` +
          `outsourceCost=${outsourceCost.toFixed(2)} ` +
          `total=${totalMaterialCost.toFixed(2)}`,
      );
    }

    // ── STEP 2: Direct Labour Cost (INCREMENTAL SLAB) ────────────
    // Total production across ALL products for this team
    const totalProduction =
      prodOut.finalProd[0] +
      prodOut.finalProd[1] +
      prodOut.finalProd[2] +
      prodOut.finalProd[3];

    // Fix 5A: FORECAST.labcostch is an ADDITIVE Rs-per-unit delta on
    // the base slab rates, not a percentage multiplier. Use the
    // absolute value because the sign convention in legacy DBFs stores
    // wage HIKES as negatives (legacy treats labcostch as "savings",
    // so a -1 value applied to costs adds 1/unit). TODO: even with
    // this fix, MPA-iipm Q1 golden shows base + 2 (not base + 1); the
    // extra +1 likely comes from CAPTAB.cumlabred training deltas we
    // do not yet track.
    const labDelta = Math.abs(forecast.labcostch ?? 0);

    const laborCost = incrementalSlab(totalProduction, [
      { limit: gameaid.blabslab1, rate: gameaid.blabcost1 + labDelta },
      { limit: gameaid.blabslab2, rate: gameaid.blabcost2 + labDelta },
      { limit: gameaid.blabslab3, rate: gameaid.blabcost3 + labDelta },
      { limit: Infinity, rate: gameaid.blabcost4 + labDelta },
    ]);

    if (DEBUG) {
      console.log(
        `[CostModule] Team ${t}: laborCost=${laborCost.toFixed(2)} ` +
          `(totalProd=${totalProduction}, labDelta=${labDelta.toFixed(3)})`,
      );
    }

    // ── STEP 3: Warehouse / Godown Cost (PURE SLAB) ──────────────
    // Total = all closing FG units + all closing RM units
    const totalClosingInventory =
      prodOut.closingFG[0] +
      prodOut.closingFG[1] +
      prodOut.closingFG[2] +
      prodOut.closingFG[3] +
      prodOut.closingRM[0] +
      prodOut.closingRM[1];

    // Apply warehouse cost change from forecast. FORECAST.delwh is a
    // percentage shift (same convention as labcostch / matcostch).
    const whMultiplier = 1 + forecast.delwh / 100;

    const warehouseCost = pureSlab(totalClosingInventory, [
      { limit: gameaid.bwhslab1, rate: gameaid.bwhcost1 * whMultiplier },
      { limit: gameaid.bwhslab2, rate: gameaid.bwhcost2 * whMultiplier },
      { limit: Infinity, rate: gameaid.bwhcost3 * whMultiplier },
    ]);

    if (DEBUG) {
      console.log(
        `[CostModule] Team ${t}: warehouseCost=${warehouseCost.toFixed(2)} ` +
          `(closingInv=${totalClosingInventory}, whMult=${whMultiplier.toFixed(3)})`,
      );
    }

    // ── STEP 4: Production Overhead (PURE SLAB on CAPACITY) ──────
    // Based on MAX(placap, maccap), NOT on production
    const maccap = capState?.maccap ?? 0;
    const placap = capState?.placap ?? 0;
    const maxCap = Math.max(maccap, placap);

    let overheadCost: number;
    if (maccap === 0 && placap === 0) {
      // Special case: no capacity at all → no overhead
      overheadCost = 0;
    } else {
      // bovrhd1/2/3 are FLAT band amounts (total cost for that capacity
      // band), NOT per-unit rates. See flatSlabLookup comment.
      // FORECAST.deltax is a percentage shift.
      const ovhMultiplier = 1 + forecast.deltax / 100;
      overheadCost = flatSlabLookup(maxCap, [
        { limit: gameaid.bovrhsb1, amount: gameaid.bovrhd1 * ovhMultiplier },
        { limit: gameaid.bovrhsb2, amount: gameaid.bovrhd2 * ovhMultiplier },
        { limit: Infinity, amount: gameaid.bovrhd3 * ovhMultiplier },
      ]);
    }

    if (DEBUG) {
      console.log(
        `[CostModule] Team ${t}: overheadCost=${overheadCost.toFixed(2)} ` +
          `(maxCap=${maxCap})`,
      );
    }

    // ── STEP 5: S&A Expenses (Marketing costs) ──────────────────
    // Total = SUM(fsad_p + vsad_p) for each product
    let totalSAD = 0;
    for (let p = 0; p < 4; p++) {
      totalSAD += getFsad(decision, p) + getVsad(decision, p);
    }
    // Fix 5B: Variable S&A — prefer GAMEAID.vsadcost (fraction, e.g. 0.06) when
    // FORECAST.varsad is absent or zero. Paper stores the rate in GAMEAID; MPX uses
    // FORECAST.varsad (~4% per quarter). Both are percentages of gross revenue.
    // Also add GAMEAID.fsadcost — game-level fixed S&A floor (e.g. Paper = 100,000/Q).
    const forecastVarsad = (forecast as ForecastParams & { varsad?: number }).varsad ?? 0;
    const varsadRate = forecastVarsad > 0
      ? forecastVarsad / 100           // FORECAST.varsad stored as percent
      : (gameaid.vsadcost ?? 0);       // GAMEAID.vsadcost stored as fraction
    if (varsadRate > 0) {
      let teamRevenue = 0;
      const prices = [
        decision.price1, decision.price2, decision.price3, decision.price4,
      ];
      for (let p = 0; p < 4; p++) {
        teamRevenue += prodOut.actualSales[p] * prices[p];
      }
      totalSAD += teamRevenue * varsadRate;
    }
    // Game-level fixed S&A base (GAMEAID.fsadcost) — applied once per team per quarter.
    totalSAD += gameaid.fsadcost ?? 0;

    // ── STEP 6: R&D Expense ─────────────────────────────────────
    const rndExpense = decision.rand1 + decision.rand2;

    // ── STEP 7: ACP (Average Cost Price) per product ────────────
    // Fix 4: productionCost includes depreciation and is ALLOCATED
    // per product via the RM recipe (rm1[p]×wax + rm2[p]×way), plus a
    // uniform share of labour/warehouse/overhead/depreciation spread
    // across all units. This matches the MPA-iipm golden where each
    // product carries its own direct RM cost but shares indirect
    // costs equally (alabcost variance aside).
    const capStatePeriod = capState; // CapacityState entry for this team
    const depreciationThisQ =
      (capStatePeriod?.deprecm ?? 0) + (capStatePeriod?.deprecp ?? 0);

    // productionCost excludes outsourceCost: outsourced goods are expensed via cash
    // (edmatc) not through P&L matrls. PANDL.prodcost = RM + lab + wh + ovh + deprec.
    const productionCost =
      materialCost + laborCost + warehouseCost + overheadCost + depreciationThisQ;

    // RM recipe per product (gameaid.rm1p × wax + gameaid.rm2p × way)
    const rm1Recipe = [gameaid.rm11, gameaid.rm12, gameaid.rm13, gameaid.rm14];
    const rm2Recipe = [gameaid.rm21, gameaid.rm22, gameaid.rm23, gameaid.rm24];
    const rmCostPerUnit = rm1Recipe.map(
      (r1, p) => r1 * prodOut.wax + rm2Recipe[p] * prodOut.way,
    );

    // Indirect (labour + warehouse + overhead + depreciation) spread
    // uniformly over total units produced. Outsourcing sits on top of
    // direct RM so it does not enter indirect.
    const indirectPool = laborCost + warehouseCost + overheadCost + depreciationThisQ;
    const indirectPerUnit = safeDivide(indirectPool, totalProduction);

    const productionCostPerUnit = rmCostPerUnit.map(
      (rmc) => rmc + indirectPerUnit,
    );

    const costPerUnit = safeDivide(productionCost, totalProduction);

    const acp: [number, number, number, number] = [0, 0, 0, 0];
    for (let p = 0; p < 4; p++) {
      const prevACPval = prevSale ? getAcp(prevSale, p) : 0;
      const cpuP = productionCostPerUnit[p];
      const openVal = prodOut.openFG[p] * prevACPval;
      const prodVal = prodOut.finalProd[p] * cpuP;
      const totalUnits = prodOut.openFG[p] + prodOut.finalProd[p];
      acp[p] = totalUnits > 0
        ? safeDivide(openVal + prodVal, totalUnits)
        : cpuP;
    }

    if (DEBUG) {
      console.log(
        `[CostModule] Team ${t}: productionCost=${productionCost.toFixed(2)} ` +
          `costPerUnit=${costPerUnit.toFixed(2)} ` +
          `acp=[${acp.map(v => v.toFixed(2)).join(', ')}]`,
      );
    }

    results.push({
      teamNo: t,
      materialCost,   // RM-only (does NOT include outsourceCost)
      outsourceCost,
      laborCost,
      warehouseCost,
      overheadCost,
      totalSAD,
      rndExpense,
      productionCost,
      acp,
      costPerUnit,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTED SLAB HELPERS (for testing)
// ═══════════════════════════════════════════════════════════════════

export { incrementalSlab, pureSlab };

// ═══════════════════════════════════════════════════════════════════
// INLINE SANITY TEST
// ═══════════════════════════════════════════════════════════════════

if (require.main === module) {
  // ─── TEST 1: Incremental slab correctness ─────────────────────
  console.log('=== COST MODULE SANITY TEST ===\n');

  // 25000 units with slabs: [0-20K @10, 20K-30K @12, 30K-50K @15, 50K+ @18]
  // Expected: 20000×10 + 5000×12 = 200000 + 60000 = 260000
  const labResult = incrementalSlab(25000, [
    { limit: 20000, rate: 10 },
    { limit: 30000, rate: 12 },
    { limit: 50000, rate: 15 },
    { limit: Infinity, rate: 18 },
  ]);
  const labExpected = 200000 + 60000;
  console.log(
    `Incremental slab (25K units): ${labResult} ` +
      `(expected ${labExpected}) ${labResult === labExpected ? 'PASS' : 'FAIL'}`,
  );

  // 55000 units: 20000×10 + 10000×12 + 20000×15 + 5000×18
  //            = 200000 + 120000 + 300000 + 90000 = 710000
  const labResult2 = incrementalSlab(55000, [
    { limit: 20000, rate: 10 },
    { limit: 30000, rate: 12 },
    { limit: 50000, rate: 15 },
    { limit: Infinity, rate: 18 },
  ]);
  const labExpected2 = 200000 + 120000 + 300000 + 90000;
  console.log(
    `Incremental slab (55K units): ${labResult2} ` +
      `(expected ${labExpected2}) ${labResult2 === labExpected2 ? 'PASS' : 'FAIL'}`,
  );

  // ─── TEST 2: Pure slab correctness ────────────────────────────
  // 25000 units in [0-20K @2, 20K-40K @3, 40K+ @4]
  // 25K falls in slab 2 → ALL at rate 3 → 75000
  const whResult = pureSlab(25000, [
    { limit: 20000, rate: 2 },
    { limit: 40000, rate: 3 },
    { limit: Infinity, rate: 4 },
  ]);
  const whExpected = 75000;
  console.log(
    `Pure slab (25K units): ${whResult} ` +
      `(expected ${whExpected}) ${whResult === whExpected ? 'PASS' : 'FAIL'}`,
  );

  // 15000 units → slab 1 → 15000×2 = 30000
  const whResult2 = pureSlab(15000, [
    { limit: 20000, rate: 2 },
    { limit: 40000, rate: 3 },
    { limit: Infinity, rate: 4 },
  ]);
  const whExpected2 = 30000;
  console.log(
    `Pure slab (15K units): ${whResult2} ` +
      `(expected ${whExpected2}) ${whResult2 === whExpected2 ? 'PASS' : 'FAIL'}`,
  );

  // ─── TEST 3: Full CostModule with production data ─────────────
  console.log('\n--- Full CostModule integration test ---');

  const testProductionOutputs: ProductionTeamResult[] = [
    {
      teamNo: 0,
      finalProd: [15000, 10000, 0, 0],
      actualSales: [14000, 9000, 0, 0],
      closingFG: [1000, 1000, 0, 0],
      ownClosingFG: [1000, 1000, 0, 0],
      openFG: [0, 0, 0, 0],
      outsourced: [0, 0, 0, 0],
      rmPurchased: [60000, 30000],
      rmConsumed: [50000, 25000],  // (15K+10K)×2=50K RM1, (15K+10K)×1=25K RM2
      closingRM: [10000, 5000],
      wax: 10.5,
      way: 8.24,
      currentRM1Price: 10.5,
      currentRM2Price: 8.24,
      usableCap: 30000,
    },
  ];

  const testDecision: TeamDecision = {
    teamNo: 0,
    prod1: 15000, prod2: 10000, prod3: 0, prod4: 0,
    price1: 45, price2: 55, price3: 0, price4: 0,
    raw1: 60000, raw2: 30000,
    fsad1: 50000, fsad2: 40000, fsad3: 0, fsad4: 0,
    vsad1: 20000, vsad2: 15000, vsad3: 0, vsad4: 0,
    dscnt1: 2, dscnt2: 2, dscnt3: 0, dscnt4: 0,
    newPCap: 0, newMCap: 0,
    stl: 0, ntwLoan: 0, nthLoan: 0, nBond: 0,
    equDiv: 0, equNo: 0, equPri: 0,
    rand1: 30000, rand2: 10000, crPrd: 0,
    alliance1: 0, alliance2: 0, alliance3: 0, alliance4: 0,
    cprod1: 0, cprod2: 0, cprod3: 0, cprod4: 0,
    cprice1: 0, cprice2: 0, cprice3: 0, cprice4: 0,
    strset: 0, bdisc: 0,
    train1: 0, train2: 0, train3: 0, train4: 0,
    prefNo: 0, prefPri: 0,
  };

  const testCostInput: CostModuleInput = {
    productionOutputs: testProductionOutputs,
    decisions: [testDecision],
    capacityStates: [
      { teamNo: 0, maccap: 30000, placap: 30000, newmcap: 0, newpcap: 0, deprecm: 0, deprecp: 0 },
    ],
    prevSaleStates: [],
    prevFinancialStates: [],
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
      rm11: 2, rm12: 2, rm13: 0, rm14: 0,
      rm21: 1, rm22: 1, rm23: 0, rm24: 0,
      lama11: 1.0, lama21: 1.0, lamb11: 1.0, lamc11: 1.0,
    },
    forecast: {
      quarterNo: 1,
      trend1: 1, trend2: 1, trend3: 1, trend4: 1,
      si1: 1, si2: 1, si3: 1, si4: 1,
      ci: 1, sensex: 100, wpi: 100, gdp: 5, mindex: 100,
      intrate: 10, geneco: 0,
      fcasta1: 0, fcasta2: 0, fcasta3: 0, fcasta4: 0,
      demand1: 32000, demand2: 21000, demand3: 0, demand4: 0,
      matcostch1: 0.05, matcostch2: 0.03,
      labcostch: 0,
      conquant1: 0, conquant2: 0, conquant3: 0, conquant4: 0,
      expoinc1: 0, expoinc2: 0, expoinc3: 0, expoinc4: 0,
      cscolp1: 0, cscolp2: 0, cscolp3: 0, cscolp4: 0,
      rm1lim: 0.5, rm2lim: 0.5,
      shipqrt: 0, odsqueze: 0, riskp: 0,
      deltax: 0, dtaxch: 0, delwh: 0,
      mcost: 0, pcost: 0,
      procpri1: 0, procpri2: 0, procpri3: 0, procpri4: 0,
      blkrm1: 0, blkrm2: 0,
    },
  };

  runCostModule(testCostInput)
    .then(output => {
      let allPass = true;

      for (const team of output) {
        console.log(`\nTeam ${team.teamNo}:`);
        console.log('  materialCost:', team.materialCost.toFixed(2));
        console.log('  laborCost:', team.laborCost.toFixed(2));
        console.log('  warehouseCost:', team.warehouseCost.toFixed(2));
        console.log('  overheadCost:', team.overheadCost.toFixed(2));
        console.log('  totalSAD:', team.totalSAD.toFixed(2));
        console.log('  rndExpense:', team.rndExpense.toFixed(2));
        console.log('  productionCost:', team.productionCost.toFixed(2));
        console.log('  costPerUnit:', team.costPerUnit.toFixed(2));
        console.log('  acp:', team.acp.map(v => v.toFixed(2)));

        // CHECK 1: laborCost > 0 if totalProduction > 0
        const totalProd =
          testProductionOutputs[0].finalProd[0] +
          testProductionOutputs[0].finalProd[1] +
          testProductionOutputs[0].finalProd[2] +
          testProductionOutputs[0].finalProd[3];
        if (totalProd > 0 && team.laborCost <= 0) {
          console.error('  FAIL: laborCost should be > 0 when production > 0');
          allPass = false;
        }

        // CHECK 2: Verify incremental slab for labor
        // 25000 units: 20000×10 + 5000×12 = 260000
        const expectedLabor = 20000 * 10 + 5000 * 12;
        if (Math.abs(team.laborCost - expectedLabor) > 0.01) {
          console.error(
            `  FAIL: laborCost=${team.laborCost} expected=${expectedLabor} ` +
              `(incremental slab verification)`,
          );
          allPass = false;
        }

        // CHECK 3: Verify pure slab for warehouse
        // Total closing inv = 1000+1000+0+0+10000+5000 = 17000
        // 17000 <= bwhslab1(20000) → rate bwhcost1(2) → 17000×2 = 34000
        const expectedWh = 17000 * 2;
        if (Math.abs(team.warehouseCost - expectedWh) > 0.01) {
          console.error(
            `  FAIL: warehouseCost=${team.warehouseCost} expected=${expectedWh} ` +
              `(pure slab verification)`,
          );
          allPass = false;
        }

        // CHECK 4: Verify flat-lookup overhead
        // maxCap = max(30000, 30000) = 30000
        // 30000 <= bovrhsb1(30000) → flat amount bovrhd1(5)
        const expectedOvh = 5;
        if (Math.abs(team.overheadCost - expectedOvh) > 0.01) {
          console.error(
            `  FAIL: overheadCost=${team.overheadCost} expected=${expectedOvh} ` +
              `(pure slab verification)`,
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

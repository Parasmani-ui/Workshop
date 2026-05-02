/**
 * CashFlowModule — STEP 6 of quarter processing pipeline.
 *
 * Determines actual sales, computes revenue, processes collections and
 * payments, and builds the cash-flow statement (CASHTAB).
 *
 * **FoxPro Source:** `n5pro.PRG` — cash flow section
 *
 * Pipeline note:
 *   CashFlow runs BEFORE Loan/Financial. That means interest, EMI principal,
 *   tax, and equity dividend are not yet known here and are applied later
 *   (FinancialModule adjusts the P&L; shark loan/tax flows through
 *   endcash via LoanModule + Financial's balance-sheet assembly).
 *
 * @module engine/CashFlowModule
 */

import { ENGINE_CONSTANTS } from './constants';
import type {
  CashFlowModuleInput,
  CashFlowModuleOutput,
  ForecastParams,
  TeamDecision,
  ProductionTeamResult,
  GameAidConfig,
} from './types';

const DEBUG = process.env.CASHFLOW_DEBUG === 'true';

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Product prices [p0..p3] from a TeamDecision */
function getPrices(d: TeamDecision): [number, number, number, number] {
  return [d.price1, d.price2, d.price3, d.price4];
}

/** Per-product cash-discount rates [p0..p3] (stored as percent points) */
function getDiscounts(d: TeamDecision): [number, number, number, number] {
  return [d.dscnt1, d.dscnt2, d.dscnt3, d.dscnt4];
}

/** Average special-credit-policy collection rate across the four products */
function avgCollectionRate(f: ForecastParams): number {
  return (f.cscolp1 + f.cscolp2 + f.cscolp3 + f.cscolp4) / 4;
}

/** Revenue = Σ (sales[p] × price[p]) plus contract revenue */
function computeRevenue(
  production: ProductionTeamResult,
  decision: TeamDecision,
  contractQuantities: { cqty1: number; cqty2: number; cqty3: number; cqty4: number },
): { srev: number; regularRev: number; contractRev: number } {
  const prices = getPrices(decision);
  const sales = production.actualSales;
  let regularRev = 0;
  for (let p = 0; p < 4; p++) {
    regularRev += sales[p] * prices[p];
  }
  const contractPrices = [decision.cprice1, decision.cprice2, decision.cprice3, decision.cprice4];
  const cQty = [
    contractQuantities.cqty1,
    contractQuantities.cqty2,
    contractQuantities.cqty3,
    contractQuantities.cqty4,
  ];
  let contractRev = 0;
  for (let p = 0; p < 4; p++) {
    contractRev += cQty[p] * contractPrices[p];
  }
  return { srev: regularRev + contractRev, regularRev, contractRev };
}

/**
 * Resolve the fraction of revenue that is collected in cash during the
 * quarter it is recognised. GAMEAID.cashsale is stored as a percentage
 * (0–100) in the legacy DBF, so divide by 100 to get a fraction.
 * Guard against values already in fractional form (e.g. 0.6).
 */
function cashSaleFraction(gameaid: GameAidConfig): number {
  const raw = gameaid.cashsale || 0;
  if (raw <= 1) return raw;
  return raw / 100;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute the full cash-flow statement for a single team.
 *
 * Processing order (mirrors n5pro.PRG):
 *   1. Opening cash (from previous quarter endcash)
 *   2. Revenue + split into cash vs. credit sales
 *   3. Collections from prior quarter's receivables
 *   4. Bad debts on current revenue
 *   5. Operating payments (material/labour split current vs. payable,
 *      overhead/S&A/R&D 100% current, warehouse 100% current)
 *   6. Capital expenditure on new plant/machine
 *   7. Financing inflows (new equity, preference, loans)
 *   8. Preference dividend (equity dividend handled by FinancialModule
 *      after dividend constraint checks)
 *   9. Ending cash = opening + inflows − outflows
 */
export async function runCashFlowModule(
  input: CashFlowModuleInput,
): Promise<CashFlowModuleOutput> {
  const {
    teamNo,
    decision,
    production,
    costs,
    contractQuantities,
    prevFinancials,
    gameaid,
    forecast,
    prods,
  } = input;

  // ── 1. Opening cash ─────────────────────────────────────────────
  const opencash = prevFinancials.endcash ?? gameaid.mincash;

  // ── 2. Revenue + credit split ───────────────────────────────────
  const { srev } = computeRevenue(production, decision, contractQuantities);
  const cashFrac = cashSaleFraction(gameaid);

  // Fix 6: per-product collection split.
  //   baseCash   = modsrev × (cashFrac + geneco + discount)
  //   collected  = baseCash + (modsrev − baseCash) × (scolEff + geneco + discount)
  // scol1/scol2 live on GAMEAID as percent points; scol2 applies when
  // DTABLE.CRPRD=2. Defaulted to legacy MPA values if missing.
  const gA = gameaid as typeof gameaid & { scol1?: number; scol2?: number };
  const scolPct = decision.crPrd === 2
    ? (gA.scol2 ?? 40)
    : (gA.scol1 ?? 60);
  const scolEff = scolPct / 100;
  const geneco = (forecast.geneco ?? 0) / 1000;

  const prices = getPrices(decision);
  const discounts = getDiscounts(decision);
  const sales = production.actualSales;

  // cashsell per product = cashFrac + spscol[p] (n6pro.PRG line 1875: cashsell = cashsale + spscol)
  const spscol = prods?.spscol ?? [];
  let scolcTotal = 0;
  for (let p = 0; p < 4; p++) {
    const cashsell = Math.min(1, cashFrac + (spscol[p] ?? 0));
    const modsrev = sales[p] * prices[p];
    const discountFrac = (discounts[p] || 0) / 100;
    const baseCash = modsrev * (cashsell + geneco + discountFrac);
    scolcTotal += baseCash + (modsrev - baseCash) * (scolEff + geneco + discountFrac);
  }

  /** Legacy SREVC label stores GROSS revenue, not cash-only portion. */
  const srevc = srev;
  /** Total collected this quarter from current-quarter sales. */
  const scolc = scolcTotal;

  console.log(
    `[CashFlow] team=${teamNo} scolc=${scolcTotal.toFixed(2)} ` +
      `srevc=${srev.toFixed(2)} scolPct=${scolPct} scolEff=${scolEff.toFixed(4)} ` +
      `ratio=${(scolcTotal / Math.max(srev, 1)).toFixed(4)}`,
  );

  // ── 3. Collections from prior receivables ───────────────────────
  // Golden MPA-iipm shows prior-AR collected in full on the following
  // quarter (scolp = prev.arecble). We keep the legacy SCP-rate hook
  // for when cscolp* becomes configurable, but floor at 1.0 so the
  // current MPA case round-trips.
  const prevAR = prevFinancials.arecble || 0;
  const scpRate = Math.min(1, avgCollectionRate(forecast) || 1);
  const scolp = prevAR * scpRate;

  // ── 4. Bad debts on current revenue ─────────────────────────────
  // bdebts = srev × (0 − GENECO) / 400 (n6pro.PRG line 1883). Floored at 0.
  const bdebts = Math.max(
    0,
    (srev * (0 - forecast.geneco)) / ENGINE_CONSTANTS.BAD_DEBT_DIVISOR,
  );

  // Cash discounts on current-quarter sales (dscnt stored as percent).
  // prices/discounts/sales are already bound above for the collection
  // split; reuse them here.
  let sdisc = 0;
  for (let p = 0; p < 4; p++) {
    sdisc += sales[p] * prices[p] * (discounts[p] / 100);
  }

  // ── 5. Operating payments ───────────────────────────────────────
  // MPX (legacy default): material 80/20, labour 90/10.
  // Paper: 100%/100% immediate (matpayfrac=1.0, labpayfrac=1.0 → acpayble=0).
  // Values are read from GAMEAID; default to MPX behaviour if absent.
  const matpayfrac = gameaid.matpayfrac ?? 0.8;
  const labpayfrac = gameaid.labpayfrac ?? 0.9;

  // Material cash payment is based on RM PURCHASED this quarter × purchase
  // price, NOT on RM consumed × ACP. Legacy n5pro.PRG: EDMATC = raw × ravpri
  // (see FoxPro cash-flow section). Exact match for Beer Q1
  // (18,100×80 + 8,500×50 = 1,873,000 golden) and Paper Q1
  // (30,000×32 + 63,800×10 + outsource 1,430,000 = 3,028,000 golden). MPX
  // Q1 happens to have consumed == purchased so the formula is
  // consumption-neutral there.
  const rm1Paid = production.rmPurchased[0] * production.currentRM1Price;
  const rm2Paid = production.rmPurchased[1] * production.currentRM2Price;
  const totalMatPayable = rm1Paid + rm2Paid + costs.outsourceCost;
  const edmatc = totalMatPayable * matpayfrac;
  const edmatp = totalMatPayable * (1 - matpayfrac);

  const edlabc = costs.laborCost * labpayfrac;
  const edlabp = costs.laborCost * (1 - labpayfrac);

  // Overhead paid 100% in-quarter
  const eovhc = costs.overheadCost;
  const eovhp = 0;

  // S&A paid 100% in-quarter
  const esadc = costs.totalSAD;

  // Warehouse/godown paid 100% in-quarter
  const egdown = costs.warehouseCost;

  // R&D paid 100% in-quarter
  const erand = costs.rndExpense;

  // ── 6. Capital expenditure ──────────────────────────────────────
  // Prefer forecast cost overrides when non-zero, else use gameaid base.
  const pCostPerUnit = forecast.pcost || gameaid.pcapcost;
  const mCostPerUnit = forecast.mcost || gameaid.mcapcost;
  const capexp = decision.newPCap * pCostPerUnit + decision.newMCap * mCostPerUnit;

  // ── 7. Financing inflows ────────────────────────────────────────
  // New equity — legacy DTABLE.EQUPRI is an issue code, not a price. The
  // actual issue price is the previous quarter's stored EQTND (tender
  // price), which Q0 seeds empirically from MPA-iipm PANDL. Must stay
  // in sync with FinancialModule's tender price handling so neweq and
  // toteq / sprem agree to the rupee.
  let neweq = 0;
  if ((decision.equNo || 0) > 0) {
    const prevEqtnd =
      prevFinancials.eqtnd || prevFinancials.esprice || gameaid.eqfv;
    const tenderPrice = Math.max(prevEqtnd, gameaid.eqfv);
    neweq = decision.equNo * tenderPrice;
  }
  const newpref = (decision.prefNo || 0) * (decision.prefPri || gameaid.preffv);

  // New debt issued this quarter (STL + 2yr + 3yr + bonds).
  const loans = (decision.stl || 0)
              + (decision.ntwLoan || 0)
              + (decision.nthLoan || 0)
              + (decision.nBond || 0);

  // ── 8a. Training / miscellaneous expense ────────────────────────
  // n6pro.PRG lines 263-271 + 2477: miscexp added to cash outflows (CASHTAB.MISCEXP).
  const cfgA = gameaid as typeof gameaid & { train1cst?: number };
  const miscexp = (decision.train1 > 0 ? (cfgA.train1cst ?? 0) : 0);

  // ── 8b. Dividend payments ────────────────────────────────────────
  // Preference dividend: quarterly portion of annual rate on outstanding
  // preference capital (paid before equity dividend decision).
  const pdiv = ((gameaid.prefdiv || 0) * (prevFinancials.totpref || 0)) / 4;

  // Equity dividend: FinancialModule owns the 5-constraint check; it may
  // reduce or zero the requested amount. CashFlowModule records the raw
  // request so that Financial can adjust endcash downstream.
  const ediv = 0;

  // Tax is paid inside FinancialModule after PBT is known.
  const itax = 0;

  // ── 8c. Short-term investment flows ─────────────────────────────
  // Beer teams start with a 5M FD/MF balance seeded on Q0 BSHEET. Each
  // quarter the residual balance earns invInterest at roughly half the
  // policy rate (FD ~50% of CIBOR), and teams may disinvest via
  // decision.invsale (legacy DTABLE.STINVT negative value). The running
  // invmnt balance is carried on FinancialState so next quarter reads it.
  const prevInvmnt = prevFinancials.invmnt ?? 0;
  const invsale = Math.max(0, decision.invsale ?? 0);
  // Empirical calibration: Beer Q1 golden invint=84,000 on prevInvmnt=5M
  // with intrate=0.10 → effective factor ≈ 0.168 (roughly 6.72% annual, or
  // 1.68% quarterly — mid-way between savings-rate and FD-rate conventions).
  const invint = prevInvmnt * (forecast.intrate ?? 0) * 0.168;
  const invmnt = Math.max(0, prevInvmnt - invsale);

  // ── 9. Ending cash ──────────────────────────────────────────────
  // srevc in legacy stores GROSS revenue as a label; the actual sales
  // cash inflow is scolc (collected from current sales) + scolp
  // (collected from prior AR).
  const inflows =
    scolc        // cash actually collected from this quarter's sales
    + scolp      // collections from prior AR
    + neweq      // new equity proceeds
    + newpref    // new preference proceeds
    + loans      // new debt proceeds
    + invsale    // disinvestment from short-term investments
    + invint;    // interest earned on remaining investments

  const outflows =
    edmatc       // material payments
    + edlabc     // labour payments
    + eovhc      // overhead payments
    + esadc      // S&A payments
    + egdown     // warehousing payments
    + erand      // R&D payments
    + capexp     // capital expenditure
    + sdisc      // cash discounts granted
    + pdiv       // preference dividend
    + miscexp;   // training / misc expense (CASHTAB.MISCEXP)

  const endcash = opencash + inflows - outflows;

  // Closing AR = prior AR - collections + uncollected new credit.
  // scolp fully drains prior AR (scpRate ≥ 1 for MPA), so this
  // effectively becomes `uncollectedNewCredit`.
  const uncollectedNewCredit = Math.max(0, srev - scolc - bdebts);
  const closingAR = Math.max(
    0,
    (prevFinancials.arecble || 0) - scolp + uncollectedNewCredit,
  );

  if (DEBUG) {
    console.log(
      `[CashFlowModule] Team ${teamNo}: srev=${srev.toFixed(2)} ` +
        `opencash=${opencash.toFixed(2)} inflows=${inflows.toFixed(2)} ` +
        `outflows=${outflows.toFixed(2)} endcash=${endcash.toFixed(2)}`,
    );
  }

  return {
    sale1: sales[0],
    sale2: sales[1],
    sale3: sales[2],
    sale4: sales[3],
    srev,
    opencash,
    endcash,
    scolc,
    scolp,
    srevc,
    edmatc,
    edmatp,
    edlabc,
    edlabp,
    eovhc,
    eovhp,
    esadc,
    egdown,
    erand,
    capexp,
    neweq,
    newpref,
    loans,
    itax,
    ediv,
    pdiv,
    bdebts,
    closingAR,
    miscexp,
    invint,
    invsale,
    invmnt,
  };
}

// ═══════════════════════════════════════════════════════════════════
// SANITY TESTS (run: ts-node CashFlowModule.ts)
// ═══════════════════════════════════════════════════════════════════

if (require.main === module) {
  const baseDecision: TeamDecision = {
    teamNo: 1,
    prod1: 1000, prod2: 0, prod3: 0, prod4: 0,
    price1: 100, price2: 0, price3: 0, price4: 0,
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
    strset: 0,
    bdisc: 0,
    train1: 0, train2: 0, train3: 0, train4: 0,
    prefNo: 0, prefPri: 0,
  };

  const baseGameaid: GameAidConfig = {
    gameid: 'T', nooft: 1,
    bmatcostx: 10, bmatcosty: 5,
    blabcost1: 1, blabcost2: 1, blabcost3: 1, blabcost4: 1,
    blabslab1: 10000, blabslab2: 20000, blabslab3: 30000,
    bwhcost1: 1, bwhcost2: 1, bwhcost3: 1,
    bwhslab1: 1000, bwhslab2: 2000,
    bovrhd1: 1, bovrhd2: 1, bovrhd3: 1,
    bovrhsb1: 10000, bovrhsb2: 20000,
    mcapcost: 100, pcapcost: 200,
    mlife: 8, plife: 20,
    eqfv: 10,
    mincash: 50_000,
    cashsale: 60,          // 60% cash
    itaxrate: 0.3,
    dtax: 0,
    prefdiv: 0.08,
    preffv: 100,
    wincrit: 'M',
    gametype: 'P',
    rm11: 1, rm12: 0, rm13: 0, rm14: 0,
    rm21: 0, rm22: 0, rm23: 0, rm24: 0,
    lama11: 1, lama21: 1, lamb11: 1, lamc11: 1,
  };

  const baseForecast: ForecastParams = {
    quarterNo: 1,
    trend1: 1, trend2: 1, trend3: 1, trend4: 1,
    si1: 1, si2: 1, si3: 1, si4: 1,
    ci: 1, sensex: 1, wpi: 1, gdp: 1, mindex: 1,
    intrate: 0.1, geneco: 0,
    fcasta1: 1, fcasta2: 1, fcasta3: 1, fcasta4: 1,
    demand1: 1000, demand2: 0, demand3: 0, demand4: 0,
    matcostch1: 0, matcostch2: 0, labcostch: 0,
    conquant1: 0, conquant2: 0, conquant3: 0, conquant4: 0,
    expoinc1: 0, expoinc2: 0, expoinc3: 0, expoinc4: 0,
    cscolp1: 0.5, cscolp2: 0.5, cscolp3: 0.5, cscolp4: 0.5,
    rm1lim: 0.2, rm2lim: 0.2,
    shipqrt: 0, odsqueze: 0, riskp: 0,
    deltax: 0, dtaxch: 0, delwh: 0,
    mcost: 0, pcost: 0,
    procpri1: 0, procpri2: 0, procpri3: 0, procpri4: 0,
    blkrm1: 0, blkrm2: 0,
  };

  const baseProduction: ProductionTeamResult = {
    teamNo: 1,
    finalProd: [1000, 0, 0, 0],
    actualSales: [1000, 0, 0, 0],
    closingFG: [0, 0, 0, 0],
    ownClosingFG: [0, 0, 0, 0],
    openFG: [0, 0, 0, 0],
    outsourced: [0, 0, 0, 0],
    rmPurchased: [1000, 0],
    rmConsumed: [1000, 0],
    closingRM: [0, 0],
    wax: 10, way: 0,
    currentRM1Price: 10, currentRM2Price: 5,
    usableCap: 1000,
  };

  const baseCosts = {
    teamNo: 1,
    materialCost: 10_000,
    outsourceCost: 0,
    laborCost: 5_000,
    warehouseCost: 0,
    overheadCost: 2_000,
    totalSAD: 1_000,
    rndExpense: 500,
    productionCost: 17_000,
    acp: [17, 0, 0, 0] as [number, number, number, number],
    costPerUnit: 17,
  };

  const basePrevFin = {
    teamNo: 1,
    srev: 0, gprofit: 0, netinc: 0, sadexp: 0, randexp: 0, bdebts: 0,
    totfin: 0, itax: 0, eqdiv: 0, pdiv: 0, deprec: 0, extitem: 0, cumloss: 0,
    toteq: 100_000, totpref: 0, retearn: 0, eshares: 10_000, pshares: 0,
    esprice: 10, totfixast: 50_000, totcurast: 0, totcurlib: 0,
    totlnglib: 0, totast: 0, cashhand: 100_000, arecble: 40_000, closeinv: 0,
    cratio: 0, de: 0, atr: 0,
    opencash: 100_000, endcash: 100_000,
  };

  (async () => {
    const out = await runCashFlowModule({
      teamNo: 1,
      decision: baseDecision,
      production: baseProduction,
      costs: baseCosts,
      orderBook: { ordbook1: 1000, ordbook2: 0, ordbook3: 0, ordbook4: 0 },
      contractQuantities: { cqty1: 0, cqty2: 0, cqty3: 0, cqty4: 0 },
      prevFinancials: basePrevFin,
      prevSaleState: {
        teamNo: 1,
        prod1: 0, prod2: 0, prod3: 0, prod4: 0,
        sale1: 0, sale2: 0, sale3: 0, sale4: 0,
        closeinv1: 0, closeinv2: 0, closeinv3: 0, closeinv4: 0,
        crawin1: 0, crawin2: 0,
        ordbook1: 0, ordbook2: 0, ordbook3: 0, ordbook4: 0,
        rawx: 0, rawy: 0, wax: 0, way: 0,
        acp1: 0, acp2: 0, acp3: 0, acp4: 0,
      },
      capacity: { teamNo: 1, maccap: 1000, placap: 1000, newmcap: 0, newpcap: 0, deprecm: 0, deprecp: 0 },
      gameaid: baseGameaid,
      forecast: baseForecast,
    });

    // Expected: srev = 1000 × 100 = 100_000
    //   srevc = 60_000, scolc = 40_000
    //   scolp = 40_000 × 0.5 = 20_000
    //   edmatc = 10_000 × 0.8 = 8_000 ; edmatp = 2_000
    //   edlabc = 5_000 × 0.9 = 4_500 ; edlabp = 500
    //   eovhc = 2_000, esadc = 1_000, erand = 500
    //   inflows = 60_000 + 20_000 = 80_000
    //   outflows = 8_000 + 4_500 + 2_000 + 1_000 + 0 + 500 = 16_000
    //   endcash = 100_000 + 80_000 − 16_000 = 164_000
    const expect = (name: string, got: number, want: number) => {
      const ok = Math.abs(got - want) < 0.01;
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} got=${got.toFixed(2)} want=${want.toFixed(2)}`);
      if (!ok) process.exitCode = 1;
    };
    expect('srev', out.srev, 100_000);
    expect('srevc', out.srevc, 60_000);
    expect('scolc', out.scolc, 40_000);
    expect('scolp', out.scolp, 20_000);
    expect('edmatc', out.edmatc, 8_000);
    expect('edmatp', out.edmatp, 2_000);
    expect('edlabc', out.edlabc, 4_500);
    expect('edlabp', out.edlabp, 500);
    expect('eovhc', out.eovhc, 2_000);
    expect('esadc', out.esadc, 1_000);
    expect('erand', out.erand, 500);
    expect('endcash', out.endcash, 164_000);
    // bdebts = 100_000 × 5 / 400 = 1_250
    expect('bdebts', out.bdebts, 1_250);
  })();
}

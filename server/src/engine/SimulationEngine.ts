/**
 * SimulationEngine — Top-level orchestrator for quarter processing.
 *
 * Calls all 10 engine modules in the MANDATORY processing order
 * defined in CLAUDE.md Section 3. This is the single entry point
 * that the backend controller invokes to process a quarter.
 *
 * **FoxPro Source:** `QPSTART1.PRG` — quarter processing controller
 *
 * Processing Order (MANDATORY — do not change sequence):
 *   1. CapacityModule   — per team
 *   2. EventModule      — per team (before Production, so strikes can zero it)
 *   3. DemandModule     — all teams together
 *   4. ProductionModule — all teams (batch)
 *   5. CostModule       — all teams (batch)
 *   6. ContractModule   — all teams together
 *   7. CashFlowModule   — per team
 *   8. LoanModule       — per team (shark loan trigger uses cashFlow.endcash)
 *   9. FinancialModule  — per team (assembles P&L + BS)
 *  10. ValuationModule  — per team (needs industry averages)
 *
 * Persistence (MongoDB writes) is deliberately NOT handled here —
 * this function is a pure simulation. The engine controller is
 * responsible for loading prev state and saving the returned outputs.
 *
 * @module engine/SimulationEngine
 */

import type {
  QuarterEngineInput,
  QuarterEngineOutput,
  CapacityState,
  SaleState,
  FinancialState,
  TeamDecision,
  DemandModuleOutput,
  ProductionTeamResult,
  CostTeamResult,
  ContractModuleOutput,
  CashFlowModuleOutput,
  LoanModuleOutput,
  FinancialModuleOutput,
  ValuationModuleOutput,
  EventModuleOutput,
  LoanEntry,
} from './types';

import { runCapacityModule } from './CapacityModule';
import { runDemandModule } from './DemandModule';
import { runProductionModule } from './ProductionModule';
import { runCostModule } from './CostModule';
import { runContractModule } from './ContractModule';
import { runCashFlowModule } from './CashFlowModule';
import { runFinancialModule } from './FinancialModule';
import { runLoanModule } from './LoanModule';
import { runValuationModule } from './ValuationModule';
import { runEventModule } from './EventModule';
import { getIO } from '../socketInstance';

const DEBUG = process.env.ENGINE_DEBUG === 'true';

// ═══════════════════════════════════════════════════════════════════
// DEFAULT STATE FACTORIES (Q1 fallback when prev state is missing)
// ═══════════════════════════════════════════════════════════════════

function defaultCapacity(teamNo: number): CapacityState {
  return {
    teamNo,
    maccap: 0,
    placap: 0,
    newmcap: 0,
    newpcap: 0,
    deprecm: 0,
    deprecp: 0,
  };
}

function defaultSale(teamNo: number): SaleState {
  return {
    teamNo,
    prod1: 0, prod2: 0, prod3: 0, prod4: 0,
    sale1: 0, sale2: 0, sale3: 0, sale4: 0,
    closeinv1: 0, closeinv2: 0, closeinv3: 0, closeinv4: 0,
    crawin1: 0, crawin2: 0,
    ordbook1: 0, ordbook2: 0, ordbook3: 0, ordbook4: 0,
    rawx: 0, rawy: 0,
    wax: 0, way: 0,
    acp1: 0, acp2: 0, acp3: 0, acp4: 0,
  };
}

function defaultFinancial(teamNo: number): FinancialState {
  return {
    teamNo,
    srev: 0, gprofit: 0, netinc: 0, sadexp: 0, randexp: 0, bdebts: 0,
    totfin: 0, itax: 0, eqdiv: 0, pdiv: 0, deprec: 0, extitem: 0, cumloss: 0,
    toteq: 0, totpref: 0, retearn: 0, eshares: 0, pshares: 0, esprice: 0,
    totfixast: 0, totcurast: 0, totcurlib: 0, totlnglib: 0, totast: 0,
    cashhand: 0, arecble: 0, closeinv: 0,
    cratio: 1, de: 0, atr: 0,
    opencash: 0, endcash: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════

/**
 * Process a complete quarter for all teams.
 *
 * Modules run in the mandatory order above. Per-module try/catch wraps
 * each phase so failure messages identify which module broke. On error,
 * emits `game:processingError` via Socket.IO and re-throws so the
 * controller layer can surface the failure.
 *
 * @param input - Full quarter input bundle (all teams' decisions + prev state)
 * @returns Full quarter output bundle (all teams' results)
 */
export async function processQuarter(
  input: QuarterEngineInput,
): Promise<QuarterEngineOutput> {
  const {
    gameId,
    quarterNo,
    gameaid,
    forecast,
    prods,
    allDecisions,
    prevSaleStates,
    prevFinancialStates,
    prevCapacityStates,
  } = input;
  const existingLoansByTeam = input.existingLoans ?? {};
  const prevStrikeStates = input.prevStrikeStates ?? {};

  const noOfTeams = allDecisions.length;
  const startTime = Date.now();
  console.log(
    `[Engine] Q${quarterNo} start — game=${gameId} teams=${noOfTeams}`,
  );

  // ── Lookup helpers (fall back to zero state for Q1) ─────────────
  const prevCapBy = (t: number): CapacityState =>
    prevCapacityStates.find(c => c.teamNo === t) ?? defaultCapacity(t);
  const prevFinBy = (t: number): FinancialState =>
    prevFinancialStates.find(f => f.teamNo === t) ?? defaultFinancial(t);
  const prevSaleBy = (t: number): SaleState =>
    prevSaleStates.find(s => s.teamNo === t) ?? defaultSale(t);

  try {
    // ─────────────────────────────────────────────────────────────
    // STEP 1 — CapacityModule (per team, independent)
    // ─────────────────────────────────────────────────────────────
    const capacityStates: CapacityState[] = await step(
      'CapacityModule',
      quarterNo,
      () =>
        Promise.all(
          allDecisions.map(async d => {
            const out = await runCapacityModule({
              teamNo: d.teamNo,
              decision: d,
              prevCapacity: prevCapBy(d.teamNo),
              gameaid,
            });
            return out.capacity;
          }),
        ),
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 2 — EventModule (per team, before Production)
    // A team on strike has productionFactor = 0 and its production
    // decisions are zeroed before DemandModule sees them.
    // ─────────────────────────────────────────────────────────────
    const eventOutputs: EventModuleOutput[] = await step(
      'EventModule',
      quarterNo,
      () =>
        Promise.all(
          allDecisions.map(d => {
            const prevSale = prevSaleBy(d.teamNo);
            const prevTotalProduction =
              prevSale.prod1 + prevSale.prod2 + prevSale.prod3 + prevSale.prod4;
            return runEventModule({
              teamNo: d.teamNo,
              quarterNo,
              decision: d,
              prevStrikeState: prevStrikeStates[d.teamNo] ?? 0,
              prevTotalProduction,
              forecast,
              gameaid,
            });
          }),
        ),
    );

    // Apply strike production factors — zero out production on full strike.
    const adjustedDecisions: TeamDecision[] = allDecisions.map((d, i) => {
      const f = eventOutputs[i].productionFactor;
      if (f === 1) return d;
      return {
        ...d,
        prod1: Math.floor(d.prod1 * f),
        prod2: Math.floor(d.prod2 * f),
        prod3: Math.floor(d.prod3 * f),
        prod4: Math.floor(d.prod4 * f),
      };
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 3 — DemandModule (all teams together)
    // ─────────────────────────────────────────────────────────────
    const demandOutput: DemandModuleOutput = await step(
      'DemandModule',
      quarterNo,
      () =>
        runDemandModule({
          allDecisions: adjustedDecisions,
          prevSaleStates,
          forecast,
          prods,
          gameaid,
        }),
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 4 — ProductionModule (batch)
    // ─────────────────────────────────────────────────────────────
    const productionOutputs: ProductionTeamResult[] = await step(
      'ProductionModule',
      quarterNo,
      () =>
        runProductionModule({
          decisions: adjustedDecisions,
          demandOutput,
          capacityStates,
          prevSaleStates,
          forecast,
          gameaid,
        }),
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 5 — CostModule (batch)
    // ─────────────────────────────────────────────────────────────
    const costOutputs: CostTeamResult[] = await step(
      'CostModule',
      quarterNo,
      () =>
        runCostModule({
          productionOutputs,
          decisions: adjustedDecisions,
          capacityStates,
          prevSaleStates,
          prevFinancialStates,
          gameaid,
          forecast,
        }),
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 6 — ContractModule (all teams together)
    // ─────────────────────────────────────────────────────────────
    const contractOutput: ContractModuleOutput = await step(
      'ContractModule',
      quarterNo,
      () =>
        runContractModule({
          allDecisions: adjustedDecisions,
          forecast,
          gameaid,
        }),
    );

    // ─────────────────────────────────────────────────────────────
    // Build per-team lookup maps for the sequential stages below.
    // ─────────────────────────────────────────────────────────────
    const productionBy = (t: number): ProductionTeamResult => {
      const r = productionOutputs.find(p => p.teamNo === t);
      if (!r) throw new Error(`no production result for team ${t}`);
      return r;
    };
    const costBy = (t: number): CostTeamResult => {
      const r = costOutputs.find(c => c.teamNo === t);
      if (!r) throw new Error(`no cost result for team ${t}`);
      return r;
    };
    const capacityBy = (t: number): CapacityState => {
      const r = capacityStates.find(c => c.teamNo === t);
      if (!r) throw new Error(`no capacity state for team ${t}`);
      return r;
    };

    // ─────────────────────────────────────────────────────────────
    // STEP 7 — CashFlowModule (per team)
    // Runs before Loan so that its endcash can drive the shark-loan
    // trigger. Does not yet reflect loan EMIs / tax / eqdiv — those
    // are settled inside FinancialModule.
    // ─────────────────────────────────────────────────────────────
    const cashFlowOutputs: CashFlowModuleOutput[] = await step(
      'CashFlowModule',
      quarterNo,
      () =>
        Promise.all(
          adjustedDecisions.map(d => {
            const t = d.teamNo;
            const alloc = contractOutput.teamAllocations[t];
            const contractQuantities = {
              cqty1: alloc?.contractUnits[0] ?? 0,
              cqty2: alloc?.contractUnits[1] ?? 0,
              cqty3: alloc?.contractUnits[2] ?? 0,
              cqty4: alloc?.contractUnits[3] ?? 0,
            };
            const orderBookEntry = demandOutput.orderBooks.find(
              ob => ob.teamNo === t,
            );
            const orderBook = {
              ordbook1: orderBookEntry?.ordbook1 ?? 0,
              ordbook2: orderBookEntry?.ordbook2 ?? 0,
              ordbook3: orderBookEntry?.ordbook3 ?? 0,
              ordbook4: orderBookEntry?.ordbook4 ?? 0,
            };
            return runCashFlowModule({
              teamNo: t,
              decision: d,
              production: productionBy(t),
              costs: costBy(t),
              orderBook,
              contractQuantities,
              prevFinancials: prevFinBy(t),
              prevSaleState: prevSaleBy(t),
              capacity: capacityBy(t),
              gameaid,
              forecast,
              prods,
            });
          }),
        ),
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 8 — LoanModule (per team)
    // Pass a synthetic FinancialState whose endcash = cashFlow.endcash,
    // so the shark-loan trigger uses the current quarter's operating
    // cash position rather than the previous quarter's closing cash.
    // `existingLoans` is empty until QuarterEngineInput carries loan
    // state — callers can pre-seed the LoanMaster collection via the
    // engine controller once that plumbing lands.
    // ─────────────────────────────────────────────────────────────
    const loanOutputs: LoanModuleOutput[] = await step(
      'LoanModule',
      quarterNo,
      () =>
        Promise.all(
          adjustedDecisions.map((d, i) => {
            const prevFin = prevFinBy(d.teamNo);
            const syntheticFin: FinancialState = {
              ...prevFin,
              endcash: cashFlowOutputs[i].endcash,
            };
            const existingLoans: LoanEntry[] =
              existingLoansByTeam[d.teamNo] ?? [];
            return runLoanModule({
              teamNo: d.teamNo,
              decision: d,
              existingLoans,
              financials: syntheticFin,
              gameaid,
              forecast,
            });
          }),
        ),
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 9 — FinancialModule (per team) — final P&L + BS assembly
    // ─────────────────────────────────────────────────────────────
    const financialOutputs: FinancialModuleOutput[] = await step(
      'FinancialModule',
      quarterNo,
      () =>
        Promise.all(
          adjustedDecisions.map((d, i) =>
            runFinancialModule({
              teamNo: d.teamNo,
              decision: d,
              cashFlow: cashFlowOutputs[i],
              production: productionBy(d.teamNo),
              costs: costBy(d.teamNo),
              capacity: capacityBy(d.teamNo),
              prevCapacity: prevCapBy(d.teamNo),
              prevFinancials: prevFinBy(d.teamNo),
              prevSaleState: prevSaleBy(d.teamNo),
              gameaid,
              forecast,
              loans: loanOutputs[i],
            }),
          ),
        ),
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 10 — ValuationModule (per team)
    // Industry averages are computed across all teams' current-quarter
    // financials so every team sees the same P/E and EPS reference.
    // Passing 0 for industryAvgPE triggers ValuationModule's internal
    // DEFAULT_INDUSTRY_PE fallback, which is the right behaviour at Q1
    // when no teams have established earnings yet.
    // ─────────────────────────────────────────────────────────────
    const { industryAvgPE, industryAvgEPS } = computeIndustryAverages(
      financialOutputs,
      prevFinancialStates,
    );

    const valuationOutputs: ValuationModuleOutput[] = await step(
      'ValuationModule',
      quarterNo,
      () =>
        Promise.all(
          adjustedDecisions.map((d, i) =>
            runValuationModule({
              teamNo: d.teamNo,
              financials: financialOutputs[i].financials,
              decision: d,
              gameaid,
              forecast,
              industryAvgPE,
              industryAvgEPS,
            }),
          ),
        ),
    );

    // ─────────────────────────────────────────────────────────────
    // Assemble QuarterEngineOutput
    // FinancialModule sets esprice to a placeholder; overwrite with
    // the final ValuationModule figure here.
    // ─────────────────────────────────────────────────────────────
    const teamOutputs = adjustedDecisions.map((d, i) => {
      const t = d.teamNo;
      const prod = productionBy(t);
      const cost = costBy(t);
      const fin = financialOutputs[i].financials;
      const val = valuationOutputs[i];
      const cap = capacityBy(t);
      const cashFlow = cashFlowOutputs[i];
      const event = eventOutputs[i];
      const pandlDetail = financialOutputs[i].pandlDetail;

      const orderBookEntry = demandOutput.orderBooks.find(ob => ob.teamNo === t);
      const saledata: SaleState = {
        teamNo: t,
        prod1: prod.finalProd[0], prod2: prod.finalProd[1],
        prod3: prod.finalProd[2], prod4: prod.finalProd[3],
        sale1: prod.actualSales[0], sale2: prod.actualSales[1],
        sale3: prod.actualSales[2], sale4: prod.actualSales[3],
        closeinv1: prod.closingFG[0], closeinv2: prod.closingFG[1],
        closeinv3: prod.closingFG[2], closeinv4: prod.closingFG[3],
        crawin1: prod.closingRM[0], crawin2: prod.closingRM[1],
        ordbook1: orderBookEntry?.ordbook1 ?? 0,
        ordbook2: orderBookEntry?.ordbook2 ?? 0,
        ordbook3: orderBookEntry?.ordbook3 ?? 0,
        ordbook4: orderBookEntry?.ordbook4 ?? 0,
        rawx: prod.rmPurchased[0], rawy: prod.rmPurchased[1],
        wax: prod.wax, way: prod.way,
        acp1: financialOutputs[i].acp1,
        acp2: financialOutputs[i].acp2,
        acp3: financialOutputs[i].acp3,
        acp4: financialOutputs[i].acp4,
      };

      const financials: FinancialState = { ...fin, esprice: val.esprice };

      return {
        teamNo: t,
        saledata,
        financials,
        capacity: cap,
        loans: loanOutputs[i],
        strikeState: event.newStrikeState,
        costs: cost,
        cashFlow,
        production: prod,
        event,
        pandlDetail,
      };
    });

    const processedAt = new Date();
    const elapsed = Date.now() - startTime;
    console.log(
      `[Engine] Q${quarterNo} complete — game=${gameId} teams=${noOfTeams} ` +
        `elapsed=${elapsed}ms`,
    );

    // Best-effort socket broadcast. Silent no-op if Socket.IO hasn't
    // been wired yet (scripts, unit tests).
    try {
      const io = getIO();
      io.to(gameId).emit('game:processingComplete', {
        gameId,
        quarterNo,
        teamsProcessed: noOfTeams,
        elapsed,
      });
    } catch {
      if (DEBUG) console.log('[Engine] Socket.IO not available — skipping emit');
    }

    return {
      gameId,
      quarterNo,
      teamOutputs,
      processedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[Engine] Q${quarterNo} FAILED — game=${gameId}: ${message}`,
      err instanceof Error ? err.stack : undefined,
    );
    try {
      const io = getIO();
      io.to(gameId).emit('game:processingError', {
        gameId,
        quarterNo,
        error: message,
      });
    } catch {
      /* silent */
    }
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Wrap a single module invocation with a module-tagged error so that
 * failures bubble up with a clear indication of which phase broke.
 */
async function step<T>(
  moduleName: string,
  quarterNo: number,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  try {
    const result = await fn();
    if (DEBUG) {
      console.log(`[Engine]   ${moduleName} ok (${Date.now() - t0}ms)`);
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[${moduleName}] Q${quarterNo}: ${message}`);
  }
}

/**
 * Compute industry-wide P/E and EPS so every team in ValuationModule
 * references the same benchmarks.
 *
 * - EPS = Σ netinc / Σ shares (industry-weighted, not per-team mean).
 * - P/E = mean prev-quarter share price / industry EPS.
 *   At Q1 (prev esprice = 0) the P/E collapses to 0 and the valuation
 *   module uses its hardcoded fallback.
 */
function computeIndustryAverages(
  financialOutputs: FinancialModuleOutput[],
  prevFinancialStates: FinancialState[],
): { industryAvgPE: number; industryAvgEPS: number } {
  const totals = financialOutputs.reduce(
    (acc, f) => {
      acc.netinc += f.financials.netinc;
      acc.shares += f.financials.eshares;
      return acc;
    },
    { netinc: 0, shares: 0 },
  );
  const industryAvgEPS =
    totals.shares > 0 ? totals.netinc / totals.shares : 0;

  let priceSum = 0;
  let priceCount = 0;
  for (const p of prevFinancialStates) {
    if (p.esprice > 0) {
      priceSum += p.esprice;
      priceCount += 1;
    }
  }
  const avgPrevPrice = priceCount > 0 ? priceSum / priceCount : 0;
  const industryAvgPE =
    industryAvgEPS > 0 ? avgPrevPrice / industryAvgEPS : 0;

  return { industryAvgPE, industryAvgEPS };
}

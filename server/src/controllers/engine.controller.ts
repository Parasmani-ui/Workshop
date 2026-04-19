import type { Request, Response, NextFunction } from 'express';
import { Game, Decision, QuarterOutput, LoanMaster } from '../models';
import { processQuarter as runQuarter } from '../engine/SimulationEngine';
import { getIO } from '../socketInstance';
import type {
  QuarterEngineInput,
  SaleState,
  FinancialState,
  CapacityState,
  TeamDecision,
  LoanEntry,
} from '../engine/types';

/**
 * Internal engine-run + persist pipeline. Throws on any failure so callers
 * can distinguish success from silent failure. `triggerProcessing` wraps
 * this and swallows errors for fire-and-forget callers (game.controller).
 */
export async function processAndPersist(gameId: string, quarterNo: number): Promise<void> {
    // 1. Load game + scenario
    const game = await Game.findOne({ gameId }).populate('scenarioId');
    if (!game) throw new Error(`Game ${gameId} not found`);

    const scenario = game.scenarioId as unknown as import('../models').IScenario;
    if (!scenario) throw new Error(`Scenario not found for game ${gameId}`);

    // 2. Extract scenario config
    const gameaid = scenario.gameaid;
    const prodstrai = scenario.prodstrai;

    // 3. Load forecast for this quarter
    const forecast = scenario.forecast.find((f) => f.quarterNo === quarterNo);
    if (!forecast) throw new Error(`No forecast data for quarter ${quarterNo}`);

    // 4. Load all decisions for this quarter
    const decisions = await Decision.find({ gameId, quarterNo }).lean();

    // 5. Load previous quarter outputs. Q1 pulls the Q0 bootstrap record
    // seeded by basedata.PRG (legacy) / seedMPX.ts (here), which carries
    // the teams' initial capacity and starting cash — without this, every
    // team enters Q1 with zero plant/machine and can't produce.
    const prevOutputs = await QuarterOutput
      .find({ gameId, quarterNo: quarterNo - 1 })
      .lean();

    // 6. Map into QuarterEngineInput shape
    const prevSaleStates: SaleState[] = prevOutputs.map((o) => ({
      teamNo: o.teamNo,
      prod1: o.saledata?.prod1 || 0, prod2: o.saledata?.prod2 || 0,
      prod3: o.saledata?.prod3 || 0, prod4: o.saledata?.prod4 || 0,
      sale1: o.saledata?.sale1 || 0, sale2: o.saledata?.sale2 || 0,
      sale3: o.saledata?.sale3 || 0, sale4: o.saledata?.sale4 || 0,
      closeinv1: o.saledata?.closeinv1 || 0, closeinv2: o.saledata?.closeinv2 || 0,
      closeinv3: o.saledata?.closeinv3 || 0, closeinv4: o.saledata?.closeinv4 || 0,
      crawin1: o.saledata?.crawin1 || 0, crawin2: o.saledata?.crawin2 || 0,
      ordbook1: o.saledata?.ordbook1 || 0, ordbook2: o.saledata?.ordbook2 || 0,
      ordbook3: o.saledata?.ordbook3 || 0, ordbook4: o.saledata?.ordbook4 || 0,
      rawx: o.saledata?.rawx || 0, rawy: o.saledata?.rawy || 0,
      wax: o.saledata?.wax || 0, way: o.saledata?.way || 0,
      acp1: o.pandl?.acp1 || 0, acp2: o.pandl?.acp2 || 0,
      acp3: o.pandl?.acp3 || 0, acp4: o.pandl?.acp4 || 0,
    }));

    const prevFinancialStates: FinancialState[] = prevOutputs.map((o) => ({
      teamNo: o.teamNo,
      // P&L
      srev: o.pandl?.srev || 0,
      gprofit: o.pandl?.gprofit || 0,
      netinc: o.pandl?.netinc || 0,
      sadexp: o.pandl?.sadexp || 0,
      randexp: o.pandl?.randexp || 0,
      bdebts: o.pandl?.bdebts || 0,
      totfin: o.pandl?.totfin || 0,
      itax: o.pandl?.itax || 0,
      eqdiv: o.pandl?.eqdiv || 0,
      pdiv: o.pandl?.pdiv || 0,
      deprec: o.pandl?.deprec || 0,
      extitem: o.pandl?.extitem || 0,
      cumloss: o.pandl?.cumloss || 0,
      // Balance Sheet
      toteq: o.bsheet?.toteq || 0,
      totpref: o.bsheet?.totpref || 0,
      retearn: o.bsheet?.retearn || 0,
      eshares: o.bsheet?.eshares || 0,
      pshares: o.bsheet?.pshares || 0,
      esprice: o.bsheet?.esprice || 0,
      totfixast: o.bsheet?.totfixast || 0,
      totcurast: o.bsheet?.totcurast || 0,
      totcurlib: o.bsheet?.totcurlib || 0,
      totlnglib: o.bsheet?.totlnglib || 0,
      totast: o.bsheet?.totast || 0,
      cashhand: o.bsheet?.cashhand || 0,
      arecble: o.bsheet?.arecble || 0,
      closeinv: o.bsheet?.closeinv || 0,
      cratio: o.bsheet?.cratio || 0,
      de: o.bsheet?.de || 0,
      atr: o.bsheet?.atr || 0,
      // Equity tender price carried from prior quarter — consumed by
      // FinancialModule + CashFlowModule as the issue price when equNo>0
      eqtnd: o.pandl?.eqtnd || 0,
      sprem: o.bsheet?.sprem || 0,
      psprem: o.bsheet?.psprem || 0,
      totlib: o.bsheet?.totlib || 0,
      // Cash
      opencash: o.cashtab?.opencash || 0,
      endcash: o.cashtab?.endcash || 0,
    }));

    const prevCapacityStates: CapacityState[] = prevOutputs.map((o) => ({
      teamNo: o.teamNo,
      maccap: o.captab?.maccap || 0,
      placap: o.captab?.placap || 0,
      newmcap: o.captab?.newmcap || 0,
      newpcap: o.captab?.newpcap || 0,
      // deprecm/deprecp carry the CUMULATIVE balance for the capacity
      // rollforward — BSHEET stores cumulative (Fix 3), CAPTAB stores
      // period. Fall back to captab for Q0 where only captab is seeded.
      deprecm: o.bsheet?.deprecm ?? o.captab?.deprecm ?? 0,
      deprecp: o.bsheet?.deprecp ?? o.captab?.deprecp ?? 0,
    }));

    const allDecisions: TeamDecision[] = decisions.map((d) => ({
      teamNo: d.teamNo,
      prod1: d.prod1, prod2: d.prod2, prod3: d.prod3, prod4: d.prod4,
      price1: d.price1, price2: d.price2, price3: d.price3, price4: d.price4,
      raw1: d.raw1, raw2: d.raw2,
      fsad1: d.fsad1, fsad2: d.fsad2, fsad3: d.fsad3, fsad4: d.fsad4,
      vsad1: d.vsad1, vsad2: d.vsad2, vsad3: d.vsad3, vsad4: d.vsad4,
      dscnt1: d.dscnt1, dscnt2: d.dscnt2, dscnt3: d.dscnt3, dscnt4: d.dscnt4,
      newPCap: d.newPCap, newMCap: d.newMCap,
      stl: d.stl, ntwLoan: d.ntwLoan, nthLoan: d.nthLoan, nBond: d.nBond,
      equDiv: d.equDiv, equNo: d.equNo, equPri: d.equPri,
      prefNo: d.prefNo, prefPri: d.prefPri,
      rand1: d.rand1, rand2: d.rand2,
      crPrd: d.crPrd,
      alliance1: d.alliance1, alliance2: d.alliance2, alliance3: d.alliance3, alliance4: d.alliance4,
      cprod1: d.cprod1, cprod2: d.cprod2, cprod3: d.cprod3, cprod4: d.cprod4,
      cprice1: d.cprice1, cprice2: d.cprice2, cprice3: d.cprice3, cprice4: d.cprice4,
      strset: d.strset, bdisc: d.bdisc,
      train1: d.train1, train2: d.train2, train3: d.train3, train4: d.train4,
    }));

    // Load active loans (LoanMaster) carried over from prior quarters,
    // grouped by teamNo. Engine convention: `endsin` is the number of
    // quarters remaining on the loan, not an absolute quarter number, so
    // a loan is "active" whenever endsin > 0.
    const loanDocs = await LoanMaster.find({
      gameId,
      endsin: { $gt: 0 },
    }).lean();
    const existingLoans: Record<number, LoanEntry[]> = {};
    for (const l of loanDocs) {
      const entry: LoanEntry = {
        loanNo: l.loanNo ?? 0,
        lamount: l.lamount ?? 0,
        intrate: l.intrate ?? 0,
        duration: l.duration ?? 0,
        amountdue: l.amountdue ?? 0,
        emi: l.emi ?? 0,
        endsin: l.endsin ?? 0,
      };
      (existingLoans[l.teamNo] ??= []).push(entry);
    }

    // Strike-state machine: prior value comes from prevOutputs.strikeState
    // (persisted by this controller after each run). If prevOutputs is
    // empty — e.g. Q1 bootstrap before EventModule has ever run — every
    // team starts in state 0 (normal).
    const prevStrikeStates: Record<number, number> = {};
    for (const d of allDecisions) {
      const prev = prevOutputs.find((o) => o.teamNo === d.teamNo);
      prevStrikeStates[d.teamNo] = prev?.strikeState ?? 0;
    }

    const input: QuarterEngineInput = {
      gameId,
      quarterNo,
      gameaid: gameaid as unknown as QuarterEngineInput['gameaid'],
      forecast: forecast as unknown as QuarterEngineInput['forecast'],
      prods: prodstrai as unknown as QuarterEngineInput['prods'],
      allDecisions,
      prevSaleStates,
      prevFinancialStates,
      prevCapacityStates,
      existingLoans,
      prevStrikeStates,
    };

    // 7. Run engine (currently throws 'not yet implemented')
    const output = await runQuarter(input);

    // 8. Save outputs — map engine module outputs into the QuarterOutput model.
    // The engine returns the raw CostTeamResult / CashFlowModuleOutput /
    // ProductionTeamResult / PandlDetail alongside the aggregate
    // FinancialState, so we can write every DBF-equivalent field.
    for (const teamOutput of output.teamOutputs) {
      const {
        financials: fin,
        saledata: sd,
        capacity: cap,
        costs: cst,
        cashFlow: cf,
        production: prod,
        event: ev,
        pandlDetail: det,
        loans: loanOut,
      } = teamOutput;

      await QuarterOutput.findOneAndUpdate(
        { gameId, teamNo: teamOutput.teamNo, quarterNo },
        {
          gameId,
          teamNo: teamOutput.teamNo,
          quarterNo,
          pandl: {
            // Revenue + aggregates
            srev: fin.srev, gprofit: fin.gprofit, netinc: fin.netinc,
            sadexp: fin.sadexp, randexp: fin.randexp, bdebts: fin.bdebts,
            totfin: fin.totfin, itax: fin.itax, eqdiv: fin.eqdiv,
            pdiv: fin.pdiv, deprec: fin.deprec, extitem: fin.extitem,
            cumloss: fin.cumloss, esprice: fin.esprice,
            ttoteq: fin.toteq,
            // Equity tender price — next quarter reads this as issue price
            eqtnd: fin.eqtnd ?? 0,
            // Line items (newly persisted)
            openinv: det.openinv,
            matrls: det.matrls,
            labour: det.labour,
            totdircst: det.totdircst,
            whose: det.whose,
            othovh: det.othovh,
            prodcost: det.prodcost,
            gafs: det.openinv + det.prodcost,
            closinv: det.closinvFG,
            cofgs: det.cofgs,
            miscexp: det.miscexp,
            // ACP per product
            acp1: sd.acp1, acp2: sd.acp2, acp3: sd.acp3, acp4: sd.acp4,
          },
          bsheet: {
            eshares: fin.eshares, pshares: fin.pshares, retearn: fin.retearn,
            toteq: fin.toteq, totpref: fin.totpref, esprice: fin.esprice,
            closeinv: fin.closeinv, arecble: fin.arecble, cashhand: fin.cashhand,
            totfixast: fin.totfixast, totcurast: fin.totcurast,
            totcurlib: fin.totcurlib, totlnglib: fin.totlnglib,
            totast: fin.totast, cratio: fin.cratio, atr: fin.atr, de: fin.de,
            // Liabilities total + securities premium (Fix 3 + Fix 4)
            totlib: fin.totlib ?? (fin.totcurlib + fin.totlnglib),
            sprem: fin.sprem ?? 0,
            psprem: fin.psprem ?? 0,
            // Gross plant / machinery (include units commissioned this
            // quarter) and cumulative depreciation — Fix 2 / Fix 3.
            plant:   ((cap.placap || 0) + (cap.newpcap || 0)) * gameaid.pcapcost,
            macery:  ((cap.maccap || 0) + (cap.newmcap || 0)) * gameaid.mcapcost,
            deprecp: cap.cumdeprecp ?? cap.deprecp,
            deprecm: cap.cumdeprecm ?? cap.deprecm,
            // Composition of current liabilities so ratios + reports match
            acpayble: cf.edmatp + cf.edlabp,
            shkpayble: loanOut.sharkLoan || 0,
          },
          cashtab: {
            opencash: fin.opencash,
            endcash: fin.endcash,
            // Operating collections + revenue
            srevc: cf.srevc,
            scolc: cf.scolc,
            scolp: cf.scolp,
            // Material / labour split current vs payable
            edmatc: cf.edmatc,
            edmatp: cf.edmatp,
            edlabc: cf.edlabc,
            edlabp: cf.edlabp,
            // Overhead / S&A / godown / R&D
            eovhc: cf.eovhc,
            eovhp: cf.eovhp,
            esadc: cf.esadc,
            egdown: cf.egdown,
            erand: cf.erand,
            // Capex + financing
            capexp: cf.capexp,
            neweq: cf.neweq,
            newpref: cf.newpref,
            loans: cf.loans,
            // Tax + dividends
            itax: fin.itax,
            ediv: fin.eqdiv,
            pdiv: fin.pdiv,
            // Loan service (from LoanModule, not currently broken out —
            // only totals available). Use 0 for sub-components we don't track.
            stlint: 0, stlpp: 0,
            tloanint: loanOut.totalInterest,
            bondint: 0,
            shklint: loanOut.sharkInterest || 0,
            shklrep: 0,
            sharkl: loanOut.sharkLoan || 0,
            cumpripay: 0,
            // Event
            extitem: ev.extraordinaryAmount || 0,
            miscexp: det.miscexp,
          },
          saledata: {
            prod1: sd.prod1, prod2: sd.prod2, prod3: sd.prod3, prod4: sd.prod4,
            sale1: sd.sale1, sale2: sd.sale2, sale3: sd.sale3, sale4: sd.sale4,
            closeinv1: sd.closeinv1, closeinv2: sd.closeinv2,
            closeinv3: sd.closeinv3, closeinv4: sd.closeinv4,
            crawin1: sd.crawin1, crawin2: sd.crawin2,
            ordbook1: sd.ordbook1, ordbook2: sd.ordbook2,
            ordbook3: sd.ordbook3, ordbook4: sd.ordbook4,
            rawx: sd.rawx, rawy: sd.rawy, wax: sd.wax, way: sd.way,
            // Newly persisted — RM purchase prices paid this quarter
            rawxpri: prod.currentRM1Price,
            rawypri: prod.currentRM2Price,
          },
          captab: {
            maccap: cap.maccap, placap: cap.placap,
            newmcap: cap.newmcap, newpcap: cap.newpcap,
            deprecm: cap.deprecm, deprecp: cap.deprecp,
          },
          optable: {
            dmat: cst.materialCost,
            dlab: cst.laborCost,
            ovh: cst.overheadCost,
            godown: cst.warehouseCost,
            sadcost: cst.totalSAD,
            // Labour slab rates actually applied per product — gameaid base
            // plus this quarter's forecast labcostch (percent-point add-on).
            // Approximation: uses slab-1 rate (blabcost*). Q1 Paper production
            // stays in slab 1, matching golden [30, 35, 30, 28]. Higher-slab
            // runs will refine this once CostModule surfaces effective rates.
            alabcost1: gameaid.blabcost1 + (forecast.labcostch ?? 0),
            alabcost2: gameaid.blabcost2 + (forecast.labcostch ?? 0),
            alabcost3: gameaid.blabcost3 + (forecast.labcostch ?? 0),
            alabcost4: gameaid.blabcost4 + (forecast.labcostch ?? 0),
            strikea: ev.strikeCostA || 0,
            strikeb: ev.strikeCostB || 0,
          },
          strikeState: teamOutput.strikeState,
          processedAt: new Date(),
        },
        { upsert: true, new: true }
      );
    }

    // 8b. Persist loan state. The engine returns the complete set of
    // loans that remain active after this quarter in `updatedLoans`
    // (existing loans with reduced balances, newly issued loans, and
    // any auto-triggered shark loan). We snapshot that set by deleting
    // the prior active rows for this team and re-inserting from the
    // engine output — keeping DB state exactly in sync with the engine.
    for (const teamOutput of output.teamOutputs) {
      await LoanMaster.deleteMany({
        gameId,
        teamNo: teamOutput.teamNo,
        endsin: { $gt: 0 },
      });
      for (const loan of teamOutput.loans.updatedLoans) {
        await LoanMaster.create({
          gameId,
          teamNo: teamOutput.teamNo,
          quarterNo,
          loanNo: loan.loanNo,
          lamount: loan.lamount,
          intrate: loan.intrate,
          duration: loan.duration,
          amountdue: loan.amountdue,
          emi: loan.emi,
          endsin: loan.endsin,
        });
      }
    }

    // 9. Update game status
    await Game.updateOne({ gameId }, { status: 'active' });

    // 10. Notify clients
    getIO().to(gameId).emit('game:processingComplete', { gameId, quarterNo });
}

/**
 * Fire-and-forget wrapper around processAndPersist for callers that don't
 * want to handle engine errors inline (e.g. game.controller's processQuarter).
 * Catches, logs, and emits on socket. Never throws.
 */
export async function triggerProcessing(gameId: string, quarterNo: number): Promise<void> {
  try {
    await processAndPersist(gameId, quarterNo);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown engine error';
    console.error(`[Engine] Processing failed for ${gameId} Q${quarterNo}:`, error);
    try {
      getIO().to(gameId).emit('game:processingError', { gameId, message });
    } catch {
      /* socket.io may not be initialised in scripts/tests */
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// TEST-RUN HANDLER (development-only diagnostic endpoint)
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/engine/test-run
 *
 * Body: `{ gameId?: string, quarterNo?: number }`
 *   (defaults: `gameId = "MPX-DEMO"`, `quarterNo = 1`).
 *
 * Runs the engine synchronously via processAndPersist, then re-queries
 * QuarterOutput for this game/quarter and returns a compact per-team
 * summary. Errors are surfaced as non-200 responses with the engine's
 * error message so callers can see exactly which module broke.
 */
export async function testRunHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const gameId = (req.body?.gameId as string) ?? 'MPX-DEMO';
  const quarterNo = (req.body?.quarterNo as number) ?? 1;

  console.log(`[TestRun] Starting engine test: game=${gameId} Q${quarterNo}`);
  const start = Date.now();

  try {
    await processAndPersist(gameId, quarterNo);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[TestRun] processAndPersist failed:', message);
    res.status(500).json({
      success: false,
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return;
  }

  const outputs = await QuarterOutput.find({ gameId, quarterNo })
    .select(
      'teamNo pandl.srev pandl.netinc pandl.esprice ' +
      'bsheet.toteq bsheet.cratio bsheet.cashhand bsheet.totast',
    )
    .lean();

  const elapsed = Date.now() - start;

  res.json({
    success: true,
    message: `Quarter ${quarterNo} processed in ${elapsed}ms`,
    elapsed,
    gameId,
    quarterNo,
    teamsProcessed: outputs.length,
    summary: outputs
      .sort((a, b) => a.teamNo - b.teamNo)
      .map((o: Record<string, unknown>) => {
        const pandl = (o.pandl ?? {}) as Record<string, number>;
        const bsheet = (o.bsheet ?? {}) as Record<string, number>;
        return {
          teamNo: o.teamNo,
          revenue: pandl.srev,
          netIncome: pandl.netinc,
          sharePrice: pandl.esprice,
          netWorth: bsheet.toteq,
          currentRatio: bsheet.cratio,
          cash: bsheet.cashhand,
          totalAssets: bsheet.totast,
        };
      }),
  });
}

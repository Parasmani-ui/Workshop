/**
 * CapacityModule — STEP 1 of quarter processing pipeline.
 *
 * Updates plant and machine capacity based on new investments ordered
 * this quarter, applies straight-line depreciation to existing capacity,
 * and tracks cumulative depreciation for the balance sheet.
 *
 * **FoxPro Source:** `n6pro.PRG` — CAPHED processing section
 *
 * Simplifications vs. legacy engine:
 *   The existing engine/types.ts CapacityState carries aggregate totals
 *   only (maccap, placap, newmcap, newpcap, deprecm, deprecp). Individual
 *   asset records (CAPHED) are not tracked, so per-asset age/life/expiry
 *   cannot be simulated here. Consequently:
 *     • Assets never "expire" — depreciation accumulates indefinitely.
 *     • Lead-time offsets (plant 2Q, machine 1Q) cannot be modelled;
 *       new capacity becomes available in the quarter it is ordered.
 *   When a future ticket upgrades CapacityState to hold per-asset
 *   records, expiry and lead-time logic should be added here.
 *
 * @module engine/CapacityModule
 */

import type {
  CapacityModuleInput,
  CapacityModuleOutput,
  CapacityState,
  GameAidConfig,
} from './types';
import { ENGINE_CONSTANTS } from './constants';

const DEBUG = process.env.CAPACITY_DEBUG === 'true';

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute this-quarter depreciation on the *gross* asset base using a
 * fixed rate per quarter.
 *
 * Since CapacityState does not retain purchase value, we back-compute
 * gross value from current capacity × unit cost. This mirrors the
 * legacy accounting where gross asset = units × purchase price.
 */
function depreciationThisQuarter(
  units: number,
  costPerUnit: number,
  ratePerQuarter: number,
): number {
  return units * costPerUnit * ratePerQuarter;
}

/**
 * Check a GameAidConfig value for a usable positive number. Used to
 * distinguish an explicit 0 override from a missing field.
 */
function positive(n: number | undefined): n is number {
  return typeof n === 'number' && n > 0;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute the updated capacity state for a single team.
 *
 * Processing steps:
 *   1. Add new capacity ordered this quarter (newPCap / newMCap).
 *   2. Compute straight-line depreciation on the full base.
 *   3. Accumulate depreciation totals on CapacityState.
 *
 * Depreciation rates come from ENGINE_CONSTANTS:
 *   • Plant   — PLANT_DEPRECIATION_RATE   (5% per quarter)
 *   • Machine — MACHINE_DEPRECIATION_RATE (12.5% per quarter)
 */
export async function runCapacityModule(
  input: CapacityModuleInput,
): Promise<CapacityModuleOutput> {
  const { teamNo, decision, prevCapacity, gameaid } = input;

  // ── 1. Record newly ordered capacity (not yet active) ────────────
  // Legacy behaviour: new plant takes 2 quarters to commission and new
  // machines take 1 quarter. Without per-asset records we approximate
  // this by keeping current-quarter maccap/placap = the PREVIOUS
  // capacity, and surfacing the new units separately in newmcap/newpcap
  // so CAPTAB still records the investment. The active capacity will
  // pick up the additions on the next quarter's CapacityModule run.
  const newmcap = decision.newMCap || 0;
  const newpcap = decision.newPCap || 0;

  const maccapActive = prevCapacity.maccap;
  const placapActive = prevCapacity.placap;

  // ── 2. Depreciation this quarter ─────────────────────────────────
  // Rate derived from asset life — matches legacy: each quarter burns
  // 1/life of the gross cost. GAMEAID.mlife / plife are in quarters.
  // Newly ordered units are not yet commissioned so they do not accrue
  // depreciation this quarter.
  const mRate = gameaid.mlife > 0
    ? 1 / gameaid.mlife
    : ENGINE_CONSTANTS.MACHINE_DEPRECIATION_RATE;
  const pRate = gameaid.plife > 0
    ? 1 / gameaid.plife
    : ENGINE_CONSTANTS.PLANT_DEPRECIATION_RATE;

  const machineDeprec = depreciationThisQuarter(
    maccapActive,
    gameaid.mcapcost,
    mRate,
  );
  const plantDeprec = depreciationThisQuarter(
    placapActive,
    gameaid.pcapcost,
    pRate,
  );

  // ── 3. Depreciation bookkeeping ─────────────────────────────────
  // Legacy CAPTAB stores CURRENT-PERIOD depreciation (not cumulative),
  // so we split: `deprecm/deprecp` carry the period value (for CAPTAB
  // + P&L), while `cumdeprecm/cumdeprecp` carry the cumulative total
  // (for BSHEET). prevCapacity.deprecm is loaded from the prior
  // quarter's BSHEET (cumulative) by the controller.
  const deprecm = machineDeprec;
  const deprecp = plantDeprec;
  const cumdeprecm = (prevCapacity.deprecm || 0) + machineDeprec;
  const cumdeprecp = (prevCapacity.deprecp || 0) + plantDeprec;

  // ── Service-game variant ─────────────────────────────────────────
  // For gametype='S' (Hotel, BPO) the simulation scales capacity by a
  // fixed factor. The scaling only affects the *usable* capacity
  // reported downstream; ProductionModule reads maccap/placap directly,
  // so we leave the totals untouched here.
  if (DEBUG && gameaid.gametype === 'S') {
    console.log(
      `[CapacityModule] Team ${teamNo}: service game variant ` +
        `(SERVICE_GAME_FACTOR=${ENGINE_CONSTANTS.SERVICE_GAME_FACTOR})`,
    );
  }

  const capacity: CapacityState = {
    teamNo,
    maccap: maccapActive,
    placap: placapActive,
    newmcap,
    newpcap,
    deprecm,
    deprecp,
    cumdeprecm,
    cumdeprecp,
  };

  if (DEBUG) {
    console.log(
      `[CapacityModule] Team ${teamNo}: ` +
        `maccap=${capacity.maccap} (+${newmcap}) ` +
        `placap=${capacity.placap} (+${newpcap}) ` +
        `deprecm=${deprecm.toFixed(2)} deprecp=${deprecp.toFixed(2)}`,
    );
  }

  return { capacity };
}

// ═══════════════════════════════════════════════════════════════════
// SANITY TESTS (run: ts-node CapacityModule.ts)
// ═══════════════════════════════════════════════════════════════════

if (require.main === module) {
  const baseGameaid: GameAidConfig = {
    gameid: 'T', nooft: 1,
    bmatcostx: 10, bmatcosty: 5,
    blabcost1: 1, blabcost2: 1, blabcost3: 1, blabcost4: 1,
    blabslab1: 10000, blabslab2: 20000, blabslab3: 30000,
    bwhcost1: 1, bwhcost2: 1, bwhcost3: 1,
    bwhslab1: 1000, bwhslab2: 2000,
    bovrhd1: 1, bovrhd2: 1, bovrhd3: 1,
    bovrhsb1: 10000, bovrhsb2: 20000,
    mcapcost: 100,     // Rs per unit of machine capacity
    pcapcost: 200,     // Rs per unit of plant capacity
    mlife: 8, plife: 20,
    eqfv: 10, mincash: 50_000, cashsale: 60,
    itaxrate: 0.3, dtax: 0,
    prefdiv: 0.08, preffv: 100,
    wincrit: 'M', gametype: 'P',
    rm11: 1, rm12: 1, rm13: 1, rm14: 1,
    rm21: 0, rm22: 0, rm23: 0, rm24: 0,
    lama11: 1, lama21: 1, lamb11: 1, lamc11: 1,
  };

  const zeroDecision = {
    teamNo: 1,
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
  };

  const prevCap: CapacityState = {
    teamNo: 1, maccap: 1000, placap: 1000,
    newmcap: 0, newpcap: 0, deprecm: 0, deprecp: 0,
  };

  const expect = (name: string, got: number, want: number, tol = 0.01) => {
    const ok = Math.abs(got - want) < tol;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} got=${got.toFixed(2)} want=${want.toFixed(2)}`);
    if (!ok) process.exitCode = 1;
  };

  (async () => {
    // baseGameaid uses mlife=8 → mRate = 0.125; plife=20 → pRate = 0.05.
    //
    // Test 1: No new capacity — depreciation applies to the existing base.
    //   machine: 1000 × 100 × 0.125 = 12_500
    //   plant:   1000 × 200 × 0.05  = 10_000
    const out1 = await runCapacityModule({
      teamNo: 1,
      decision: zeroDecision,
      prevCapacity: prevCap,
      gameaid: baseGameaid,
    });
    expect('t1.maccap', out1.capacity.maccap, 1000);
    expect('t1.placap', out1.capacity.placap, 1000);
    // deprecm/deprecp are now period values (this quarter only).
    expect('t1.deprecm', out1.capacity.deprecm, 12_500);
    expect('t1.deprecp', out1.capacity.deprecp, 10_000);
    expect('t1.cumdeprecm', out1.capacity.cumdeprecm ?? 0, 12_500);
    expect('t1.cumdeprecp', out1.capacity.cumdeprecp ?? 0, 10_000);

    // Test 2: Add 500 machine, 500 plant. New capacity is not active
    // this quarter (lead time) — maccap/placap stay at the prev base,
    // newmcap/newpcap record the investment, and depreciation is
    // charged only on the old active base.
    const out2 = await runCapacityModule({
      teamNo: 1,
      decision: { ...zeroDecision, newMCap: 500, newPCap: 500 },
      prevCapacity: prevCap,
      gameaid: baseGameaid,
    });
    expect('t2.maccap', out2.capacity.maccap, 1000);
    expect('t2.placap', out2.capacity.placap, 1000);
    expect('t2.newmcap', out2.capacity.newmcap, 500);
    expect('t2.newpcap', out2.capacity.newpcap, 500);
    expect('t2.deprecm', out2.capacity.deprecm, 12_500);
    expect('t2.deprecp', out2.capacity.deprecp, 10_000);

    // Test 3: Cumulative depreciation carries forward from prev. Period
    // value stays equal to this quarter's charge; cumulative adds it to
    // the incoming cumulative from prevCapacity.deprec*.
    const out3 = await runCapacityModule({
      teamNo: 1,
      decision: zeroDecision,
      prevCapacity: { ...prevCap, deprecm: 50_000, deprecp: 30_000 },
      gameaid: baseGameaid,
    });
    expect('t3.deprecm', out3.capacity.deprecm, 12_500);
    expect('t3.deprecp', out3.capacity.deprecp, 10_000);
    expect('t3.cumdeprecm', out3.capacity.cumdeprecm ?? 0, 50_000 + 12_500);
    expect('t3.cumdeprecp', out3.capacity.cumdeprecp ?? 0, 30_000 + 10_000);
  })();

  // suppress TS unused-var noise in test block
  void positive;
}

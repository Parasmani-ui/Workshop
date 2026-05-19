import { Request, Response, NextFunction } from 'express';
import { Game, Scenario, Decision, Team, QuarterOutput, LoanMaster, CapitalAsset } from '../models';
import { getIO } from '../socketInstance';
import * as engineController from './engine.controller';

export async function createGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { scenarioId, gameId } = req.body;

    const scenario = await Scenario.findById(scenarioId);
    if (!scenario) {
      res.status(400).json({ success: false, message: 'Scenario not found' });
      return;
    }

    const existing = await Game.findOne({ gameId });
    if (existing) {
      res.status(409).json({ success: false, message: 'gameId already taken' });
      return;
    }

    const game = await Game.create(req.body);
    res.status(201).json({ success: true, data: { game } });
  } catch (err) {
    next(err);
  }
}

export async function getGames(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const games = await Game.find(filter)
      .sort({ createdAt: -1 })
      .populate('scenarioId', 'name gameType productNames');

    res.status(200).json({ success: true, data: { games, count: games.length } });
  } catch (err) {
    next(err);
  }
}

export async function getGameById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId }).populate('scenarioId');
    if (!game) {
      res.status(404).json({ success: false, message: 'Game not found' });
      return;
    }
    res.status(200).json({ success: true, data: { game } });
  } catch (err) {
    next(err);
  }
}

export async function activateGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId }).populate('scenarioId');
    if (!game) {
      res.status(404).json({ success: false, message: 'Game not found' });
      return;
    }
    if (game.status !== 'setup') {
      res.status(400).json({ success: false, message: `Game is already ${game.status}` });
      return;
    }

    // Seed a Q0 bootstrap row for every team in this game. Without this the
    // first quarter starts with zero cash, zero capacity and zero shares,
    // which forces every team into the shark loan and locks production at
    // zero because usableCap = min(plant, machine) = 0. The bootstrap puts
    // each team in a playable starting position so Q1 decisions can actually
    // produce and sell. Values mirror the legacy MPA-iipm Q0 bootstrap.
    await seedQ0Bootstrap(game);

    game.status = 'active';
    game.currentQuarter = 1;
    await game.save();

    getIO().to(game.gameId).emit('game:activated', {
      gameId: game.gameId,
      currentQuarter: 1,
    });

    res.status(200).json({
      success: true,
      data: { game },
      message: 'Game activated — teams can now submit Q1 decisions',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Q0 bootstrap parameters per scenario. Without these, teams enter Q1
 * with zero everything (cash=0 → shark loan, capacity=0 → production=0
 * → 0 sales every quarter). Values mirror the legacy Q0 snapshots used
 * by the standalone seed scripts (seedMPX.ts / seedPaper.ts / seedBeer.ts)
 * so any scenario created via the API behaves the same as the demo data.
 *
 * If you add a new scenario, register its starting state here.
 */
interface Q0Bootstrap {
  maccap: number;
  placap: number;
  deprecm: number;
  deprecp: number;
  plantGross: number;
  maceryGross: number;
  totfixast: number;
  cash: number;
  arecble: number;
  acpayble: number;
  eshares: number;
  toteq: number;
  retearn: number;
  esprice: number;
  eqtnd: number;
  invmnt: number;
  acp1: number;
  acp2: number;
  acp3: number;
  acp4: number;
}

/** Per-scenario Q0 starting state. Keys are lowercase scenario-name prefixes. */
const Q0_PRESETS: Record<string, Q0Bootstrap> = {
  // MPX — mirrors seedMPX.ts Step 3b (MPA-iipm Q0 snapshot)
  mpx: {
    maccap: 15_000, placap: 15_000, deprecm: 300_000, deprecp: 300_000,
    plantGross: 3_000_000, maceryGross: 3_000_000, totfixast: 5_400_000,
    cash: 1_250_492, arecble: 2_301_270, acpayble: 1_578_128,
    eshares: 7_000_000, toteq: 7_000_000, retearn: 373_633.75,
    esprice: 1.08, eqtnd: 2.06, invmnt: 0,
    acp1: 405.34, acp2: 330.34, acp3: 255.34, acp4: 0,
  },
  // Paper — mirrors seedPaper.ts (PAA-ongcMumbai Q0)
  paper: {
    maccap: 20_000, placap: 25_000, deprecm: 0, deprecp: 0,
    plantGross: 6_250_000, maceryGross: 5_625_000, totfixast: 11_875_000,
    cash: 919_500, arecble: 0, acpayble: 0,
    eshares: 120_000, toteq: 1_200_000, retearn: 794_500,
    esprice: 10, eqtnd: 10, invmnt: 0,
    acp1: 0, acp2: 0, acp3: 0, acp4: 0,
  },
  // Beer — mirrors seedBeer.ts (BEA Q0 with 5M FD/MF balance)
  beer: {
    maccap: 10_000, placap: 10_000, deprecm: 100_000, deprecp: 100_000,
    plantGross: 2_000_000, maceryGross: 2_000_000, totfixast: 3_800_000,
    cash: 1_678_000, arecble: 0, acpayble: 0,
    eshares: 150_000, toteq: 1_500_000, retearn: -172_000,
    esprice: 10, eqtnd: 10, invmnt: 5_000_000,
    acp1: 0, acp2: 0, acp3: 0, acp4: 0,
  },
};

/**
 * Pick a Q0 preset by scenario name (case-insensitive prefix match).
 * Falls back to a generic MPX-style default when the scenario name
 * doesn't match a known preset — keeps unknown scenarios playable.
 */
function pickQ0Preset(scenarioName: string, eqfv: number): Q0Bootstrap {
  const key = scenarioName.toLowerCase();
  for (const [presetKey, preset] of Object.entries(Q0_PRESETS)) {
    if (key.includes(presetKey)) return preset;
  }
  // Generic fallback — balanced so assets = equity (no liabilities).
  const cash = 1_000_000;
  const plantUnits = 15_000;
  const machineUnits = 15_000;
  const plantGross = plantUnits * 200;
  const maceryGross = machineUnits * 200;
  const totfixast = plantGross + maceryGross;
  const eshares = 1_000_000;
  const toteq = eshares * eqfv;
  return {
    maccap: machineUnits, placap: plantUnits, deprecm: 0, deprecp: 0,
    plantGross, maceryGross, totfixast,
    cash, arecble: 0, acpayble: 0,
    eshares, toteq, retearn: cash + totfixast - toteq,
    esprice: eqfv, eqtnd: eqfv, invmnt: 0,
    acp1: 0, acp2: 0, acp3: 0, acp4: 0,
  };
}

/**
 * Q0 bootstrap — seeds each team's starting balance sheet so Q1 has
 * something to build on. Without this, teams have no capacity
 * (production = 0 every quarter), no opening cash (shark loan triggers
 * on Q1), and no equity (dividend / valuation paths break).
 *
 * Idempotent: if a Q0 record already exists for a team it's left
 * untouched.
 */
async function seedQ0Bootstrap(game: import('../models').IGameDocument): Promise<void> {
  const scenario = game.scenarioId as unknown as import('../models').IScenario | null;
  if (!scenario) return;

  const eqfv = scenario.gameaid?.eqfv ?? 1;
  const preset = pickQ0Preset(scenario.name ?? '', eqfv);

  // BS tally check: assets must equal liabilities + equity at Q0.
  //   totast    = totfixast + cash + arecble + invmnt
  //   totlib    = acpayble
  //   equity    = toteq + retearn   (no preference in any preset)
  //   ⇒ Tally requires: assets − liab − toteq = retearn
  // If preset.retearn doesn't satisfy this (e.g. when invmnt / arecble
  // are added on top of a snapshot whose retearn was derived without
  // them), the engine's BS DRIFT check fires on every Q1. Recompute
  // retearn from the other fields to guarantee tally.
  const totast =
    preset.totfixast + preset.cash + preset.arecble + preset.invmnt;
  const totlib = preset.acpayble;
  const balancedRetearn = totast - totlib - preset.toteq;

  const teams = await Team.find({ gameId: game.gameId });
  for (const team of teams) {
    const existing = await QuarterOutput.findOne({
      gameId: game.gameId,
      teamNo: team.teamNo,
      quarterNo: 0,
    });
    if (existing) continue;

    await QuarterOutput.create({
      gameId: game.gameId,
      teamNo: team.teamNo,
      quarterNo: 0,
      pandl: {
        srev: 0, gprofit: 0, netinc: 0, sadexp: 0, randexp: 0, bdebts: 0,
        sdisc: 0, totfin: 0, itax: 0, eqdiv: 0, pdiv: 0, deprec: 0,
        extitem: 0, cumloss: 0, esprice: preset.esprice,
        ttoteq: preset.toteq, eqtnd: preset.eqtnd,
        acp1: preset.acp1, acp2: preset.acp2,
        acp3: preset.acp3, acp4: preset.acp4,
      },
      bsheet: {
        eshares: preset.eshares, pshares: 0, retearn: balancedRetearn,
        toteq: preset.toteq, totpref: 0, esprice: preset.esprice,
        closeinv: 0, arecble: preset.arecble, cashhand: preset.cash,
        totfixast: preset.totfixast,
        totcurast: preset.cash + preset.arecble + preset.invmnt,
        totcurlib: preset.acpayble, totlnglib: 0,
        totast, totlib,
        plant: preset.plantGross, macery: preset.maceryGross,
        deprecp: preset.deprecp, deprecm: preset.deprecm,
        acpayble: preset.acpayble, shkpayble: 0, invmnt: preset.invmnt,
        cratio: 0, atr: 0, de: 0, pem: 0,
      },
      cashtab: { opencash: preset.cash, endcash: preset.cash },
      saledata: {
        prod1: 0, prod2: 0, prod3: 0, prod4: 0,
        sale1: 0, sale2: 0, sale3: 0, sale4: 0,
        closeinv1: 0, closeinv2: 0, closeinv3: 0, closeinv4: 0,
        crawin1: 0, crawin2: 0,
        ordbook1: 0, ordbook2: 0, ordbook3: 0, ordbook4: 0,
        rawx: 0, rawy: 0, wax: 0, way: 0,
      },
      captab: {
        maccap: preset.maccap, placap: preset.placap,
        newmcap: 0, newpcap: 0,
        deprecm: preset.deprecm, deprecp: preset.deprecp,
      },
      optable: { dmat: 0, dlab: 0, ovh: 0, godown: 0, sadcost: 0 },
      strikeState: 0,
      loanSnapshot: [],
      processedAt: new Date(),
    });
  }

  console.log(
    `[seedQ0] gameId=${game.gameId} scenario="${scenario.name}" ` +
    `teams=${teams.length} preset=${pickQ0PresetName(scenario.name ?? '')} ` +
    `cash=${preset.cash} maccap=${preset.maccap} placap=${preset.placap} ` +
    `toteq=${preset.toteq} retearn=${balancedRetearn}`,
  );
}

function pickQ0PresetName(scenarioName: string): string {
  const key = scenarioName.toLowerCase();
  for (const presetKey of Object.keys(Q0_PRESETS)) {
    if (key.includes(presetKey)) return presetKey;
  }
  return 'generic';
}

export async function lockQuarter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      res.status(404).json({ success: false, message: 'Game not found' });
      return;
    }
    if (game.status !== 'active') {
      res.status(400).json({ success: false, message: `Game is not active (current status: ${game.status})` });
      return;
    }

    game.status = 'processing';
    await game.save();

    getIO().to(game.gameId).emit('game:quarterLocked', {
      gameId: game.gameId,
      quarterNo: game.currentQuarter,
    });

    res.status(200).json({ success: true, data: { currentQuarter: game.currentQuarter } });
  } catch (err) {
    next(err);
  }
}

export async function processQuarter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      res.status(404).json({ success: false, message: 'Game not found' });
      return;
    }
    if (game.status !== 'processing') {
      res.status(400).json({ success: false, message: `Game must be in processing status (current: ${game.status})` });
      return;
    }

    const submitted = await Decision.countDocuments({
      gameId: game.gameId,
      quarterNo: game.currentQuarter,
    });

    if (submitted === 0) {
      res.status(400).json({
        success: false,
        message: 'No teams have submitted decisions yet. At least 1 team must submit.',
      });
      return;
    }

    if (submitted < game.noOfTeams) {
      console.warn(`[ProcessQuarter] Processing with ${submitted}/${game.noOfTeams} teams submitted`);
    }

    getIO().to(game.gameId).emit('game:processingStarted', { gameId: game.gameId });

    // Fire and forget — engine controller handles its own errors
    engineController.triggerProcessing(game.gameId, game.currentQuarter);

    res.status(200).json({ success: true, message: 'Quarter processing started' });
  } catch (err) {
    next(err);
  }
}

export async function publishResults(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      res.status(404).json({ success: false, message: 'Game not found' });
      return;
    }
    if (game.status !== 'processing' && game.status !== 'active') {
      res.status(400).json({ success: false, message: `Cannot publish from status: ${game.status}` });
      return;
    }

    game.currentQuarter = game.currentQuarter + 1;
    if (game.currentQuarter > game.maxQuarters) {
      game.status = 'completed';
    } else {
      game.status = 'active';
    }
    await game.save();

    getIO().to(game.gameId).emit('game:resultsPublished', {
      gameId: game.gameId,
      newQuarter: game.currentQuarter,
    });

    res.status(200).json({
      success: true,
      data: { newQuarter: game.currentQuarter, status: game.status },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId } = req.params;

    const game = await Game.findOne({ gameId });
    if (!game) {
      res.status(404).json({ success: false, message: 'Game not found' });
      return;
    }

    await Promise.all([
      Game.deleteOne({ gameId }),
      Team.deleteMany({ gameId }),
      Decision.deleteMany({ gameId }),
      QuarterOutput.deleteMany({ gameId }),
      LoanMaster.deleteMany({ gameId }),
      CapitalAsset.deleteMany({ gameId }),
    ]);

    res.status(200).json({
      success: true,
      message: `Game "${gameId}" and all related data deleted.`,
    });
  } catch (err) {
    next(err);
  }
}

export async function getGameStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId })
      .select('gameId status currentQuarter noOfTeams winCriteria');
    if (!game) {
      res.status(404).json({ success: false, message: 'Game not found' });
      return;
    }
    res.status(200).json({
      success: true,
      data: {
        gameId: game.gameId,
        status: game.status,
        currentQuarter: game.currentQuarter,
        noOfTeams: game.noOfTeams,
        winCriteria: game.winCriteria,
      },
    });
  } catch (err) {
    next(err);
  }
}

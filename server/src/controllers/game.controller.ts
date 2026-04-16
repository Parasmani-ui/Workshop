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
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      res.status(404).json({ success: false, message: 'Game not found' });
      return;
    }
    if (game.status !== 'setup') {
      res.status(400).json({ success: false, message: `Game is already ${game.status}` });
      return;
    }

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

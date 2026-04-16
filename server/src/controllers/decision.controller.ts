import { Request, Response, NextFunction } from 'express';
import { Game, Decision } from '../models';
import { getIO } from '../socketInstance';

export async function submitDecision(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId } = req.params;

    const game = await Game.findOne({ gameId });
    if (!game) {
      res.status(404).json({ success: false, message: 'Game not found' });
      return;
    }
    if (game.status !== 'active') {
      res.status(400).json({ success: false, message: `Decisions cannot be submitted — game status is ${game.status}` });
      return;
    }
    if (req.body.quarterNo !== game.currentQuarter) {
      res.status(400).json({
        success: false,
        message: `Quarter mismatch — current quarter is ${game.currentQuarter}`,
      });
      return;
    }

    if (req.body.teamNo < 0 || req.body.teamNo >= game.noOfTeams) {
      res.status(400).json({
        success: false,
        message: `Team ${req.body.teamNo} is not valid. This game only has teams 0 to ${game.noOfTeams - 1}.`,
      });
      return;
    }

    const decision = await Decision.findOneAndUpdate(
      { gameId, teamNo: req.body.teamNo, quarterNo: req.body.quarterNo },
      { ...req.body, gameId, submittedAt: new Date() },
      { upsert: true, new: true }
    );

    getIO().to(gameId).emit('team:decisionReceived', {
      teamNo: req.body.teamNo,
      quarterNo: req.body.quarterNo,
    });

    res.status(200).json({ success: true, data: { decision } });
  } catch (err) {
    next(err);
  }
}

export async function getDecisions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId, quarterNo } = req.params;

    const game = await Game.findOne({ gameId });
    if (!game) {
      res.status(404).json({ success: false, message: 'Game not found' });
      return;
    }

    const decisions = await Decision.find({ gameId, quarterNo: Number(quarterNo) });

    const allTeamNos = Array.from({ length: game.noOfTeams }, (_, i) => i);
    const submittedTeamNos = decisions.map((d) => d.teamNo);
    const missingTeams = allTeamNos.filter((t) => !submittedTeamNos.includes(t));

    res.status(200).json({
      success: true,
      data: {
        decisions,
        submittedCount: decisions.length,
        missingTeams,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getTeamDecision(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId, teamNo, quarterNo } = req.params;

    const decision = await Decision.findOne({
      gameId,
      teamNo: Number(teamNo),
      quarterNo: Number(quarterNo),
    });

    if (!decision) {
      res.status(404).json({ success: false, message: 'Decision not found' });
      return;
    }

    res.status(200).json({ success: true, data: { decision } });
  } catch (err) {
    next(err);
  }
}

export async function lockTeamDecision(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId, teamNo, quarterNo } = req.params;

    const decision = await Decision.findOneAndUpdate(
      { gameId, teamNo: Number(teamNo), quarterNo: Number(quarterNo) },
      { isLocked: true },
      { new: true }
    );

    if (!decision) {
      res.status(404).json({ success: false, message: 'Decision not found' });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

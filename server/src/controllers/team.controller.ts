import { Request, Response, NextFunction } from 'express';
import { Game, Team } from '../models';

export async function createTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId } = req.params;

    const game = await Game.findOne({ gameId });
    if (!game) {
      res.status(404).json({ success: false, message: 'Game not found' });
      return;
    }

    if (req.body.teamNo < 0 || req.body.teamNo >= game.noOfTeams) {
      res.status(400).json({
        success: false,
        message: `Team number ${req.body.teamNo} is out of range. This game only has teams 0 to ${game.noOfTeams - 1}.`,
      });
      return;
    }

    const existingTeam = await Team.findOne({ gameId, teamNo: req.body.teamNo });
    if (existingTeam) {
      res.status(409).json({ success: false, message: `Team ${req.body.teamNo} already exists in this game` });
      return;
    }

    const teamCount = await Team.countDocuments({ gameId, isActive: true });
    if (teamCount >= game.noOfTeams) {
      res.status(400).json({
        success: false,
        message: `Game already has maximum teams (${game.noOfTeams})`,
      });
      return;
    }

    const team = await Team.create({ ...req.body, gameId });
    res.status(201).json({ success: true, data: { team } });
  } catch (err) {
    next(err);
  }
}

export async function getTeams(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId } = req.params;
    const teams = await Team.find({ gameId }).sort({ teamNo: 1 });
    res.status(200).json({ success: true, data: { teams } });
  } catch (err) {
    next(err);
  }
}

export async function updateTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId, teamNo } = req.params;
    const allowed = ['teamName', 'ceo', 'cfo', 'coo', 'cmo'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const team = await Team.findOneAndUpdate(
      { gameId, teamNo: Number(teamNo) },
      updates,
      { new: true }
    );

    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    res.status(200).json({ success: true, data: { team } });
  } catch (err) {
    next(err);
  }
}

export async function deleteTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId, teamNo } = req.params;

    const team = await Team.findOneAndUpdate(
      { gameId, teamNo: Number(teamNo) },
      { isActive: false },
      { new: true }
    );

    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Team deactivated' });
  } catch (err) {
    next(err);
  }
}

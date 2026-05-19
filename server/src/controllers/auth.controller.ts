/**
 * @fileoverview Auth controller — register, login, and (for team users) joining
 * a game with a Game ID + team slot. Issues JWT tokens on successful auth.
 */

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { User, Game, Team } from '../models';
import { config } from '../config/env';
import type { AuthUserPayload } from '../middleware/auth';

const TOKEN_TTL = '7d';

function signToken(user: AuthUserPayload): string {
  return jwt.sign(user, config.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function toPayload(user: { _id: unknown; email: string; role: 'facilitator' | 'team'; name: string }): AuthUserPayload {
  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
    name: user.name,
  };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, name, role } = req.body as {
      email: string;
      password: string;
      name: string;
      role: 'facilitator' | 'team';
    };

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ success: false, message: 'Email is already registered' });
      return;
    }

    const user = await User.create({ email, password, name, role });
    const payload = toPayload(user);
    const token = signToken(payload);

    res.status(201).json({
      success: true,
      data: { user: payload, token },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const payload = toPayload(user);
    const token = signToken(payload);

    res.status(200).json({
      success: true,
      data: { user: payload, token },
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    res.status(200).json({ success: true, data: { user: req.user } });
  } catch (err) {
    next(err);
  }
}

/**
 * List all games the authenticated team user has joined.
 * Each entry: { team, game } — `game` may be null if it was deleted.
 */
export async function myGames(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'team') {
      res.status(403).json({ success: false, message: 'Only team users have joined games' });
      return;
    }
    const userObjectId = new mongoose.Types.ObjectId(req.user.id);
    const teams = await Team.find({ userId: userObjectId, isActive: true }).sort({ updatedAt: -1 });

    const gameIds = teams.map((t) => t.gameId);
    const games = await Game.find({ gameId: { $in: gameIds } });
    const gameByGid = new Map(games.map((g) => [g.gameId, g]));

    const entries = teams
      .map((t) => {
        const g = gameByGid.get(t.gameId);
        if (!g) return null;
        return {
          team: {
            gameId: t.gameId,
            teamNo: t.teamNo,
            teamName: t.teamName,
          },
          game: {
            gameId: g.gameId,
            name: g.name,
            status: g.status,
            currentQuarter: g.currentQuarter,
            maxQuarters: g.maxQuarters,
            winCriteria: g.winCriteria,
            noOfTeams: g.noOfTeams,
          },
        };
      })
      .filter(Boolean);

    res.status(200).json({ success: true, data: { games: entries } });
  } catch (err) {
    next(err);
  }
}

/**
 * Authenticated team user joins a specific game with gameId + team slot.
 * Creates or reuses a Team record for the slot.
 */
export async function joinGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'team') {
      res.status(403).json({ success: false, message: 'Only team users can join games' });
      return;
    }

    const { gameId, teamNo, teamName } = req.body as {
      gameId: string;
      teamNo: number;
      teamName?: string;
    };

    const game = await Game.findOne({ gameId });
    if (!game) {
      res.status(404).json({ success: false, message: 'Game not found' });
      return;
    }

    if (teamNo < 0 || teamNo >= game.noOfTeams) {
      res.status(400).json({
        success: false,
        message: `Team number out of range. This game has teams 1 to ${game.noOfTeams}.`,
      });
      return;
    }

    let team = await Team.findOne({ gameId, teamNo });
    if (!team) {
      team = await Team.create({
        gameId,
        teamNo,
        teamName: teamName?.trim() || req.user.name,
        ceo: req.user.name,
        userId: new mongoose.Types.ObjectId(req.user.id),
      });
    } else if (!team.userId) {
      team.userId = new mongoose.Types.ObjectId(req.user.id);
      await team.save();
    } else if (String(team.userId) !== req.user.id) {
      res.status(409).json({
        success: false,
        message: `Team ${teamNo + 1} in this game is already taken by another user`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        team,
        game: {
          gameId: game.gameId,
          name: game.name,
          status: game.status,
          currentQuarter: game.currentQuarter,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

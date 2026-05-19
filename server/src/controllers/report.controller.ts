import { Request, Response, NextFunction } from 'express';
import { Game, Team, QuarterOutput } from '../models';

export async function getTeamReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId, teamNo, quarterNo } = req.params;

    const report = await QuarterOutput.findOne({
      gameId,
      teamNo: Number(teamNo),
      quarterNo: Number(quarterNo),
    });

    if (!report) {
      res.status(404).json({ success: false, message: 'Report not available yet for this quarter' });
      return;
    }

    res.status(200).json({ success: true, data: { report } });
  } catch (err) {
    next(err);
  }
}

export async function getSectorUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId, quarterNo } = req.params;
    const qNo = Number(quarterNo);

    const reports = await QuarterOutput.find({ gameId, quarterNo: qNo });
    if (!reports.length) {
      res.status(404).json({ success: false, message: 'No reports found for this quarter' });
      return;
    }

    const teams = await Team.find({ gameId }).lean();
    const teamNameMap = new Map(teams.map((t) => [t.teamNo, t.teamName]));

    const sectorTeams = reports.map((r) => {
      const eshares = r.bsheet?.eshares || 1;
      return {
        teamNo: r.teamNo,
        teamName: teamNameMap.get(r.teamNo) || `Team ${r.teamNo}`,
        esprice: r.pandl?.esprice || 0,
        netinc: r.pandl?.netinc || 0,
        toteq: r.bsheet?.toteq || 0,
        marketCap: (r.pandl?.esprice || 0) * eshares,
        eshares,
        cratio: r.bsheet?.cratio || 0,
        de: r.bsheet?.de || 0,
        eps: eshares ? (r.pandl?.netinc || 0) / eshares : 0,
      };
    });

    sectorTeams.sort((a, b) => b.esprice - a.esprice);

    res.status(200).json({ success: true, data: { quarterNo: qNo, teams: sectorTeams } });
  } catch (err) {
    next(err);
  }
}

export async function getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId } = req.params;

    const game = await Game.findOne({ gameId });
    if (!game) {
      res.status(404).json({ success: false, message: 'Game not found' });
      return;
    }

    const teams = await Team.find({ gameId, isActive: true }).lean();
    const winCriteria = game.winCriteria;

    const leaderboard: Array<{
      rank: number;
      teamNo: number;
      teamName: string;
      value: number;
      trend: number;
      played: boolean;
    }> = [];

    for (const team of teams) {
      // Q0 is a balance-sheet bootstrap, not a played quarter — exclude it so
      // freshly-activated games show no leaderboard value until Q1 is processed.
      const allOutputs = await QuarterOutput.find({
        gameId,
        teamNo: team.teamNo,
        quarterNo: { $gt: 0 },
      })
        .sort({ quarterNo: 1 })
        .lean();

      if (!allOutputs.length) {
        leaderboard.push({
          rank: 0,
          teamNo: team.teamNo,
          teamName: team.teamName,
          value: 0,
          trend: 0,
          played: false,
        });
        continue;
      }

      const latest = allOutputs[allOutputs.length - 1];
      const prev = allOutputs.length > 1 ? allOutputs[allOutputs.length - 2] : null;
      const eshares = latest.bsheet?.eshares || 1;

      let value = 0;
      let prevValue = 0;

      switch (winCriteria) {
        case 'M': // Market Cap
          value = (latest.pandl?.esprice || 0) * eshares;
          prevValue = prev ? (prev.pandl?.esprice || 0) * (prev.bsheet?.eshares || 1) : 0;
          break;
        case 'N': // Net Worth (toteq)
          value = latest.bsheet?.toteq || 0;
          prevValue = prev?.bsheet?.toteq || 0;
          break;
        case 'P': // Cumulative PAT
          value = allOutputs.reduce((sum, o) => sum + (o.pandl?.netinc || 0), 0);
          prevValue = allOutputs.slice(0, -1).reduce((sum, o) => sum + (o.pandl?.netinc || 0), 0);
          break;
        case 'E': // EVA (proxy: esprice)
          value = latest.pandl?.esprice || 0;
          prevValue = prev?.pandl?.esprice || 0;
          break;
        case 'V': // Book Value per Share
          value = eshares ? (latest.bsheet?.toteq || 0) / eshares : 0;
          prevValue = prev ? (prev.bsheet?.eshares ? (prev.bsheet?.toteq || 0) / prev.bsheet.eshares : 0) : 0;
          break;
        case 'A': // Post-Tax EPS
          value = eshares ? (latest.pandl?.netinc || 0) / eshares : 0;
          prevValue = prev ? (prev.bsheet?.eshares ? (prev.pandl?.netinc || 0) / prev.bsheet.eshares : 0) : 0;
          break;
        case 'B': { // Pre-Tax EPS (PBT / shares) — PBT ≈ netinc + itax
          const pbt = (latest.pandl?.netinc || 0) + (latest.pandl?.itax || 0);
          value = eshares ? pbt / eshares : 0;
          const prevPbt = prev ? (prev.pandl?.netinc || 0) + (prev.pandl?.itax || 0) : 0;
          prevValue = prev?.bsheet?.eshares ? prevPbt / prev.bsheet.eshares : 0;
          break;
        }
        case 'C': { // Cash Flow per Share
          const cfps = latest.cashtab?.endcash || 0;
          value = eshares ? cfps / eshares : 0;
          const prevCfps = prev?.cashtab?.endcash || 0;
          prevValue = prev?.bsheet?.eshares ? prevCfps / prev.bsheet.eshares : 0;
          break;
        }
        case 'O': { // NW + Market Cap / 2
          const mc = (latest.pandl?.esprice || 0) * eshares;
          const nw = latest.bsheet?.toteq || 0;
          value = (mc + nw) / 2;
          const prevMc = prev ? (prev.pandl?.esprice || 0) * (prev.bsheet?.eshares || 1) : 0;
          const prevNw = prev?.bsheet?.toteq || 0;
          prevValue = (prevMc + prevNw) / 2;
          break;
        }
        default:
          value = latest.pandl?.esprice || 0;
          prevValue = prev?.pandl?.esprice || 0;
      }

      leaderboard.push({
        rank: 0,
        teamNo: team.teamNo,
        teamName: team.teamName,
        value,
        trend: value - prevValue,
        played: true,
      });
    }

    // Played teams ranked normally by value (desc). Unplayed teams keep rank 0.
    leaderboard.sort((a, b) => {
      if (a.played !== b.played) return a.played ? -1 : 1;
      return b.value - a.value;
    });
    let nextRank = 1;
    leaderboard.forEach((entry) => {
      if (entry.played) {
        entry.rank = nextRank++;
      }
    });

    res.status(200).json({
      success: true,
      data: { winCriteria, leaderboard },
    });
  } catch (err) {
    next(err);
  }
}

import axios from 'axios'
import type { Game, Team, Scenario, LeaderboardEntry } from '@/types/game.types'
import type { Decision } from '@/types/decision.types'
import type { TeamReport, SectorEntry } from '@/types/report.types'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message ?? error.message
    return Promise.reject(new Error(message))
  }
)

// ── Games ──────────────────────────────────────────────────────
export const gameApi = {
  list: (status?: string) =>
    api.get<{ success: boolean; data: { games: Game[] } }>('/games',
      { params: status ? { status } : {} }),

  get: (gameId: string) =>
    api.get<{ success: boolean; data: { game: Game } }>(`/games/${gameId}`),

  getStatus: (gameId: string) =>
    api.get<{ success: boolean; data: { status: string; currentQuarter: number } }>(
      `/games/${gameId}/status`),

  create: (body: {
    gameId: string; name: string; scenarioId: string
    winCriteria: string; noOfTeams: number; maxQuarters: number
  }) => api.post<{ success: boolean; data: { game: Game } }>('/games', body),

  activate: (gameId: string) =>
    api.patch<{ success: boolean; data: { game: Game } }>(
      `/games/${gameId}/activate`),

  lock: (gameId: string) =>
    api.patch(`/games/${gameId}/lock`),

  process: (gameId: string) =>
    api.patch(`/games/${gameId}/process`),

  publish: (gameId: string) =>
    api.patch(`/games/${gameId}/publish`),

  leaderboard: (gameId: string) =>
    api.get<{ success: boolean; data: { leaderboard: LeaderboardEntry[]; winCriteria: string } }>(
      `/games/${gameId}/leaderboard`),

  remove: (gameId: string) =>
    api.delete<{ success: boolean; message: string }>(
      `/games/${gameId}`),
}

// ── Teams ──────────────────────────────────────────────────────
export const teamApi = {
  list: (gameId: string) =>
    api.get<{ success: boolean; data: { teams: Team[] } }>(`/games/${gameId}/teams`),

  create: (gameId: string, body: Partial<Team>) =>
    api.post<{ success: boolean; data: { team: Team } }>(`/games/${gameId}/teams`, body),
}

// ── Decisions ─────────────────────────────────────────────────
export const decisionApi = {
  submit: (gameId: string, decision: Decision) =>
    api.post<{ success: boolean; data: { decision: Decision } }>(
      `/games/${gameId}/decisions`, decision),

  getAll: (gameId: string, quarterNo: number) =>
    api.get<{
      success: boolean
      data: { decisions: Decision[]; submittedCount: number; missingTeams: number[] }
    }>(`/games/${gameId}/decisions/${quarterNo}`),

  getOne: (gameId: string, teamNo: number, quarterNo: number) =>
    api.get<{ success: boolean; data: { decision: Decision } }>(
      `/games/${gameId}/decisions/${teamNo}/${quarterNo}`),
}

// ── Reports ───────────────────────────────────────────────────
export const reportApi = {
  getTeamReport: (gameId: string, teamNo: number, quarterNo: number) =>
    api.get<{ success: boolean; data: { report: TeamReport } }>(
      `/games/${gameId}/reports/${teamNo}/${quarterNo}`),

  getSectorUpdate: (gameId: string, quarterNo: number) =>
    api.get<{ success: boolean; data: { teams: SectorEntry[] } }>(
      `/games/${gameId}/reports/sector/${quarterNo}`),
}

// ── Scenarios ─────────────────────────────────────────────────
export const scenarioApi = {
  list: () =>
    api.get<{ success: boolean; data: { scenarios: Scenario[] } }>('/scenarios'),

  get: (name: string) =>
    api.get<{ success: boolean; data: { scenario: Scenario } }>(`/scenarios/${name}`),
}

export default api

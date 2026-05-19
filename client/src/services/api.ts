import axios from 'axios'
import type { Game, Team, Scenario, LeaderboardEntry } from '@/types/game.types'
import type { Decision } from '@/types/decision.types'
import type { TeamReport, SectorEntry } from '@/types/report.types'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const TOKEN_KEY = 'chanakya_token'

const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
})

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

api.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers = config.headers ?? {}
    ;(config.headers as Record<string, string>).Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message ?? error.message
    return Promise.reject(new Error(message))
  }
)

// ── Auth ──────────────────────────────────────────────────────
export interface AuthUser {
  id: string
  email: string
  role: 'facilitator' | 'team'
  name: string
}

export const authApi = {
  register: (body: {
    email: string
    password: string
    name: string
    role: 'facilitator' | 'team'
  }) =>
    api.post<{ success: boolean; data: { user: AuthUser; token: string } }>(
      '/auth/register',
      body
    ),

  login: (body: { email: string; password: string }) =>
    api.post<{ success: boolean; data: { user: AuthUser; token: string } }>(
      '/auth/login',
      body
    ),

  me: () =>
    api.get<{ success: boolean; data: { user: AuthUser } }>('/auth/me'),

  joinGame: (body: { gameId: string; teamNo: number; teamName?: string }) =>
    api.post<{
      success: boolean
      data: { team: Team; game: { gameId: string; name: string; status: string; currentQuarter: number } }
    }>('/auth/join-game', body),

  myGames: () =>
    api.get<{
      success: boolean
      data: {
        games: Array<{
          team: { gameId: string; teamNo: number; teamName: string }
          game: {
            gameId: string
            name: string
            status: 'setup' | 'active' | 'processing' | 'completed'
            currentQuarter: number
            maxQuarters: number
            winCriteria: string
            noOfTeams: number
          }
        }>
      }
    }>('/auth/my-games'),
}

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

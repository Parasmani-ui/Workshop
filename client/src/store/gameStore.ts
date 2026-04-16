import { create } from 'zustand'
import type { Game, Team, LeaderboardEntry } from '@/types/game.types'

interface GameState {
  currentGame: Game | null
  teams: Team[]
  leaderboard: LeaderboardEntry[]
  isLoading: boolean
  error: string | null
  myRole: 'facilitator' | 'team' | null
  myTeamNo: number | null
  myGameId: string | null
  processingReady: boolean

  setGame: (game: Game) => void
  setTeams: (teams: Team[]) => void
  setLeaderboard: (entries: LeaderboardEntry[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setIdentity: (role: 'facilitator' | 'team', teamNo?: number, gameId?: string) => void
  updateGameStatus: (status: Game['status'], currentQuarter?: number) => void
  setProcessingReady: (ready: boolean) => void
  reset: () => void
}

export const useGameStore = create<GameState>((set) => ({
  currentGame: null,
  teams: [],
  leaderboard: [],
  isLoading: false,
  error: null,
  myRole: null,
  myTeamNo: null,
  myGameId: null,
  processingReady: false,

  setGame: (game) => set({ currentGame: game }),
  setTeams: (teams) => set({ teams }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setIdentity: (myRole, myTeamNo, myGameId) =>
    set({
      myRole,
      myTeamNo: myTeamNo ?? null,
      myGameId: myGameId ?? null,
    }),
  updateGameStatus: (status, currentQuarter) =>
    set((state) => ({
      currentGame: state.currentGame
        ? {
            ...state.currentGame,
            status,
            currentQuarter: currentQuarter ?? state.currentGame.currentQuarter,
          }
        : null,
    })),
  setProcessingReady: (processingReady) => set({ processingReady }),
  reset: () =>
    set({
      currentGame: null,
      teams: [],
      leaderboard: [],
      error: null,
      processingReady: false,
    }),
}))

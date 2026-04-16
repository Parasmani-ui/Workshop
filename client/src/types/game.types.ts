export type GameStatus = 'setup' | 'active' | 'processing' | 'completed'
export type WinCriteria = 'M' | 'N' | 'P' | 'E' | 'V' | 'A' | 'B' | 'C' | 'O'
export type GameType = 'P' | 'S'

export interface Game {
  _id: string
  gameId: string
  name: string
  status: GameStatus
  currentQuarter: number
  maxQuarters: number
  winCriteria: WinCriteria
  noOfTeams: number
  facilitatorId: string
  scenarioId: string | Scenario
  createdAt: string
}

export interface Team {
  _id: string
  gameId: string
  teamNo: number
  teamName: string
  ceo: string
  cfo: string
  coo: string
  cmo: string
  isActive: boolean
}

export interface Scenario {
  _id: string
  name: string
  description: string
  gameType: GameType
  productNames: string[]
  rm1Name: string
  rm2Name: string
}

export interface LeaderboardEntry {
  rank: number
  teamNo: number
  teamName: string
  value: number
  trend?: 'up' | 'down' | 'same'
}

export const WIN_CRITERIA_LABELS: Record<WinCriteria, string> = {
  M: 'Market Capitalization',
  N: 'Net Worth',
  P: 'Cumulative PAT',
  E: 'EVA',
  V: 'Book Value/Share',
  A: 'Post-Tax EPS',
  B: 'Pre-Tax EPS',
  C: 'Cash Flow/Share',
  O: 'NW + Market Cap',
}

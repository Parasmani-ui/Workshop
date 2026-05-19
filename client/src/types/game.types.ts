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

export interface ScenarioGameAid {
  // RM consumption recipe per product (units of RM per unit of product)
  rm11: number; rm12: number; rm13: number; rm14: number
  rm21: number; rm22: number; rm23: number; rm24: number
  // Capacity costs per unit
  pcapcost: number; mcapcost: number
  // Other fields exist on the server; these are the ones the client uses for
  // its decision-side validator. Add more as needed.
}

export interface ScenarioForecast {
  quarterNo: number
  // RM purchase limit (fraction): max purchase = prev_purchase × (1 + rm_lim)
  rm1lim: number
  rm2lim: number
}

export interface Scenario {
  _id: string
  name: string
  description: string
  gameType: GameType
  productNames: string[]
  rm1Name: string
  rm2Name: string
  // Optional — populated by the server when the game has a populated scenarioId.
  // Used by the Decision Entry validator to surface capacity / RM-recipe warnings.
  gameaid?: ScenarioGameAid
  forecast?: ScenarioForecast[]
}

export interface LeaderboardEntry {
  rank: number
  teamNo: number
  teamName: string
  value: number
  trend?: 'up' | 'down' | 'same'
  /** True once Q1+ has been processed for this team. False for unplayed games. */
  played?: boolean
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

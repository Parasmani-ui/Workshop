import { create } from 'zustand'
import type { Decision } from '@/types/decision.types'
import type { TeamReport } from '@/types/report.types'

interface TeamState {
  currentDecision: Decision | null
  myReports: TeamReport[]
  setCurrentDecision: (decision: Decision | null) => void
  setMyReports: (reports: TeamReport[]) => void
  reset: () => void
}

export const useTeamStore = create<TeamState>((set) => ({
  currentDecision: null,
  myReports: [],

  setCurrentDecision: (currentDecision) => set({ currentDecision }),
  setMyReports: (myReports) => set({ myReports }),
  reset: () => set({ currentDecision: null, myReports: [] }),
}))

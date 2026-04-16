export interface Decision {
  gameId: string
  teamNo: number
  quarterNo: number
  // Production
  prod1: number; prod2: number; prod3: number; prod4: number
  price1: number; price2: number; price3: number; price4: number
  raw1: number; raw2: number
  // Marketing
  fsad1: number; fsad2: number; fsad3: number; fsad4: number
  vsad1: number; vsad2: number; vsad3: number; vsad4: number
  dscnt1: number; dscnt2: number; dscnt3: number; dscnt4: number
  // Capacity
  newPCap: number; newMCap: number
  // Finance
  stl: number; ntwLoan: number; nthLoan: number; nBond: number
  equDiv: number; equNo: number; equPri: number
  prefNo: number; prefPri: number
  // R&D
  rand1: number; rand2: number
  // Other
  mesage: string
  strset: number
  bdisc: number
  train1: number; train2: number; train3: number; train4: number
  submittedAt?: string
  isLocked: boolean
}

export type DecisionDraft = Omit<Decision, 'submittedAt' | 'isLocked'>

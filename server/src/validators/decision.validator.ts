import { z } from 'zod';

const nonNeg = z.number().min(0).default(0);
const posOrZero = z.number().min(0).default(0);

export const decisionSchema = z.object({
  // Meta (required)
  gameId: z.string().min(1),
  teamNo: z.number().int().min(0).max(19),
  quarterNo: z.number().int().min(1),

  // Production
  prod1: nonNeg, prod2: nonNeg, prod3: nonNeg, prod4: nonNeg,
  price1: posOrZero, price2: posOrZero, price3: posOrZero, price4: posOrZero,
  raw1: nonNeg, raw2: nonNeg,

  // Marketing
  fsad1: nonNeg, fsad2: nonNeg, fsad3: nonNeg, fsad4: nonNeg,
  vsad1: nonNeg, vsad2: nonNeg, vsad3: nonNeg, vsad4: nonNeg,
  dscnt1: nonNeg, dscnt2: nonNeg, dscnt3: nonNeg, dscnt4: nonNeg,

  // Capacity
  newPCap: nonNeg,
  newMCap: nonNeg,

  // Finance
  stl: nonNeg,
  ntwLoan: nonNeg,
  nthLoan: nonNeg,
  nBond: nonNeg,
  equDiv: nonNeg,
  equNo: nonNeg,
  equPri: nonNeg,
  prefNo: nonNeg,
  prefPri: nonNeg,

  // R&D
  rand1: nonNeg,
  rand2: nonNeg,

  // Contracts
  crPrd: nonNeg,
  alliance1: nonNeg, alliance2: nonNeg, alliance3: nonNeg, alliance4: nonNeg,
  conAward1: nonNeg, conAward2: nonNeg, conAward3: nonNeg, conAward4: nonNeg,
  cprod1: nonNeg, cprod2: nonNeg, cprod3: nonNeg, cprod4: nonNeg,
  cprice1: nonNeg, cprice2: nonNeg, cprice3: nonNeg, cprice4: nonNeg,

  // Other
  mesage: z.string().default(''),
  macsale: nonNeg,
  plasale: nonNeg,
  strset: nonNeg,
  bdisc: nonNeg,
  train1: nonNeg, train2: nonNeg, train3: nonNeg, train4: nonNeg,
});

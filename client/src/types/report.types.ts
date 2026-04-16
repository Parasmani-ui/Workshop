export interface PandL {
  srev: number; gprofit: number; netinc: number
  sadexp: number; randexp: number; bdebts: number; sdisc: number
  totfin: number; tloanint: number; bondint: number; stlint: number; shkint: number
  itax: number; eqdiv: number; pdiv: number; deprec: number
  extitem: number; esprice: number
  acp1: number; acp2: number; acp3: number; acp4: number
  cumloss: number
}

export interface BSheet {
  eshares: number; pshares: number; retearn: number; toteq: number
  esprice: number; closeinv: number; arecble: number; cashhand: number
  totfixast: number; totcurast: number; totcurlib: number
  totlnglib: number; totast: number
  twyloans: number; thyloans: number; bonds: number
  cratio: number; de: number; atr: number; pem: number
}

export interface SaleData {
  prod1: number; prod2: number; prod3: number; prod4: number
  sale1: number; sale2: number; sale3: number; sale4: number
  closeinv1: number; closeinv2: number; closeinv3: number; closeinv4: number
  ordbook1: number; ordbook2: number; ordbook3: number; ordbook4: number
  rawx: number; rawy: number; wax: number; way: number
}

export interface TeamReport {
  gameId: string
  teamNo: number
  quarterNo: number
  pandl: PandL
  bsheet: BSheet
  saledata: SaleData
  processedAt: string
}

export interface SectorEntry {
  teamNo: number
  teamName: string
  esprice: number
  netinc: number
  toteq: number
  marketCap: number
  eshares: number
  cratio: number
  de: number
  eps: number
}

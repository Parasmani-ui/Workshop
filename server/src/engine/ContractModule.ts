/**
 * ContractModule — STEP 5 of quarter processing pipeline.
 *
 * Processes alliance/tender bids for contract manufacturing. Each team
 * may bid — individually or as part of an alliance — to supply one or
 * more of the four products at a stated price and quantity. For every
 * product the alliance with the lowest weighted-average bid price wins
 * the entire contract, and the contract quantity is split between its
 * members in proportion to the quantity each member pledged.
 *
 * **FoxPro Source:** `n6pro.PRG` — contract/alliance section
 *
 * @module engine/ContractModule
 */

import type {
  ContractAllocation,
  ContractModuleInput,
  ContractModuleOutput,
  ForecastParams,
  ProductContract,
  TeamContractAllocation,
  TeamDecision,
} from './types';

type ProductIndex = 1 | 2 | 3 | 4;

interface Bidder {
  teamNo: number;
  bidPrice: number;
  bidQty: number;
}

function getAllianceCode(d: TeamDecision, p: ProductIndex): number {
  switch (p) {
    case 1: return d.alliance1;
    case 2: return d.alliance2;
    case 3: return d.alliance3;
    case 4: return d.alliance4;
  }
}

function getBidPrice(d: TeamDecision, p: ProductIndex): number {
  switch (p) {
    case 1: return d.cprice1;
    case 2: return d.cprice2;
    case 3: return d.cprice3;
    case 4: return d.cprice4;
  }
}

function getBidQty(d: TeamDecision, p: ProductIndex): number {
  switch (p) {
    case 1: return d.cprod1;
    case 2: return d.cprod2;
    case 3: return d.cprod3;
    case 4: return d.cprod4;
  }
}

function getContractQty(forecast: ForecastParams, p: ProductIndex): number {
  switch (p) {
    case 1: return forecast.conquant1;
    case 2: return forecast.conquant2;
    case 3: return forecast.conquant3;
    case 4: return forecast.conquant4;
  }
}

/**
 * Group bidding teams by alliance code for a single product.
 * Teams with allianceCode === 0 are treated as not bidding.
 */
function groupBiddersByAlliance(
  decisions: TeamDecision[],
  product: ProductIndex,
): Map<number, Bidder[]> {
  const groups = new Map<number, Bidder[]>();
  for (const d of decisions) {
    const code = getAllianceCode(d, product);
    if (code <= 0) continue;
    const qty = getBidQty(d, product);
    if (qty <= 0) continue;
    const bucket = groups.get(code) ?? [];
    bucket.push({
      teamNo: d.teamNo,
      bidPrice: getBidPrice(d, product),
      bidQty: qty,
    });
    groups.set(code, bucket);
  }
  return groups;
}

/**
 * Compute weighted average bid price for an alliance:
 *   weightedAvg = Σ(bidPrice × bidQty) / Σ(bidQty)
 */
function weightedAveragePrice(bidders: Bidder[]): { avgPrice: number; totalQty: number } {
  let numerator = 0;
  let totalQty = 0;
  for (const b of bidders) {
    numerator += b.bidPrice * b.bidQty;
    totalQty += b.bidQty;
  }
  const avgPrice = totalQty > 0 ? numerator / totalQty : 0;
  return { avgPrice, totalQty };
}

/**
 * Allocate the fixed contract quantity across winning alliance members,
 * proportional to each member's pledged bid quantity. Rounding residue
 * is assigned to the last member so allocations sum exactly to contractQty.
 */
function allocateProportionally(
  winners: Bidder[],
  contractQty: number,
  totalBidQty: number,
  winningPrice: number,
): ContractAllocation[] {
  const out: ContractAllocation[] = [];
  let running = 0;
  winners.forEach((member, idx) => {
    let qty: number;
    if (idx === winners.length - 1) {
      qty = contractQty - running;
    } else {
      qty = Math.round((member.bidQty / totalBidQty) * contractQty);
      running += qty;
    }
    if (qty < 0) qty = 0;
    out.push({
      teamNo: member.teamNo,
      quantity: qty,
      revenue: qty * winningPrice,
    });
  });
  return out;
}

/**
 * Process contract/tender bids across all teams and determine winners.
 *
 * Processing steps:
 * 1. For each product (1..4) with a non-zero contract quantity in FORECAST:
 * 2. Group teams by their alliance code on that product.
 * 3. Compute weighted average bid price per alliance.
 * 4. Winner = alliance with the lowest weighted average price. Tie-break:
 *    the alliance with the smallest code wins.
 * 5. Allocate the contract quantity proportionally to members' pledged qty.
 * 6. Non-winning alliances and non-bidding teams receive nothing.
 *
 * @param input - All teams' decisions, forecast contract params, game config
 * @returns ProductContract[] and per-team rollup allocations
 */
export async function runContractModule(
  input: ContractModuleInput,
): Promise<ContractModuleOutput> {
  const { allDecisions, forecast } = input;

  const productContracts: ProductContract[] = [];
  const teamAllocations: Record<number, TeamContractAllocation> = {};

  const ensureTeam = (teamNo: number): TeamContractAllocation => {
    let entry = teamAllocations[teamNo];
    if (!entry) {
      entry = {
        contractUnits: [0, 0, 0, 0],
        contractRevenue: [0, 0, 0, 0],
        totalContractRevenue: 0,
      };
      teamAllocations[teamNo] = entry;
    }
    return entry;
  };

  // Seed every team so callers can index by teamNo without undefined checks.
  for (const d of allDecisions) ensureTeam(d.teamNo);

  const products: ProductIndex[] = [1, 2, 3, 4];

  for (const p of products) {
    const contractQty = getContractQty(forecast, p);

    if (contractQty <= 0) {
      productContracts.push({
        productIndex: p,
        contractQty: 0,
        winningAlliance: 0,
        winningPrice: 0,
        allocations: [],
        noWinner: true,
      });
      continue;
    }

    const groups = groupBiddersByAlliance(allDecisions, p);

    if (groups.size === 0) {
      productContracts.push({
        productIndex: p,
        contractQty,
        winningAlliance: 0,
        winningPrice: 0,
        allocations: [],
        noWinner: true,
      });
      continue;
    }

    // Deterministic iteration: sort alliance codes ascending so that a
    // tie on weighted-average price is broken by the smaller code.
    const sortedCodes = Array.from(groups.keys()).sort((a, b) => a - b);

    let winningCode = 0;
    let winningPrice = Number.POSITIVE_INFINITY;
    let winningBidders: Bidder[] = [];
    let winningTotalQty = 0;

    for (const code of sortedCodes) {
      const bidders = groups.get(code)!;
      const { avgPrice, totalQty } = weightedAveragePrice(bidders);
      if (totalQty <= 0) continue;
      if (avgPrice < winningPrice) {
        winningPrice = avgPrice;
        winningCode = code;
        winningBidders = bidders;
        winningTotalQty = totalQty;
      }
    }

    if (winningCode === 0) {
      productContracts.push({
        productIndex: p,
        contractQty,
        winningAlliance: 0,
        winningPrice: 0,
        allocations: [],
        noWinner: true,
      });
      continue;
    }

    const allocations = allocateProportionally(
      winningBidders,
      contractQty,
      winningTotalQty,
      winningPrice,
    );

    productContracts.push({
      productIndex: p,
      contractQty,
      winningAlliance: winningCode,
      winningPrice,
      allocations,
      noWinner: false,
    });

    const productIdx0 = p - 1;
    for (const alloc of allocations) {
      const entry = ensureTeam(alloc.teamNo);
      entry.contractUnits[productIdx0] = alloc.quantity;
      entry.contractRevenue[productIdx0] = alloc.revenue;
      entry.totalContractRevenue += alloc.revenue;
    }
  }

  return { productContracts, teamAllocations };
}

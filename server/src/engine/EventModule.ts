/**
 * EventModule — STEP 10 of quarter processing pipeline.
 *
 * Manages the strike/go-slow state machine, extraordinary items,
 * and export incentives. The strike system has 6 states that
 * progress based on the team's settlement decision (`strset`).
 *
 * **FoxPro Source:** `n5pro.PRG` — strike/event section
 *
 * @module engine/EventModule
 */

import { ENGINE_CONSTANTS } from './constants';
import type { EventModuleInput, EventModuleOutput } from './types';

/**
 * Strike state → production multiplier.
 *
 * State 0 / 5 = normal (post-tribunal resumes full production).
 * States 1–3 = warning / negotiation, go-slow at 80%.
 * State 4 = strike, zero production.
 */
const PRODUCTION_FACTOR_BY_STATE: Record<number, number> = {
  0: 1.0,
  1: 0.8,
  2: 0.8,
  3: 0.8,
  4: 0.0,
  5: 1.0,
};

interface Transition {
  newState: number;
  message: string;
  wageHike: number;
}

/**
 * Advance the strike state machine by one quarter.
 *
 * Transition rules (see CLAUDE.md §3 Step 10):
 *   0 → 1 with probability gameaid.strikea1o% (random draw)
 *   1 → 0 if team accepts (strset=1, Rs 6/unit), else 1 → 2
 *   2 → 0 if accept (Rs 6/unit), else 2 → 3
 *   3 → 0 if accept (Rs 10/unit), else 3 → 4
 *   4 → 5 automatic (strike in progress, Rs 15/unit, zero production)
 *   5 → 0 automatic (tribunal decree, Rs 18/unit permanent hike)
 */
function advanceStrikeState(
  currentState: number,
  strset: number,
  warningProbability: number,
  randomFactor: number,
): Transition {
  const W = ENGINE_CONSTANTS.STRIKE_WAGE_HIKE;

  switch (currentState) {
    case 0: {
      if (randomFactor < warningProbability) {
        return {
          newState: 1,
          message: 'Strike warning issued. Settlement offer coming.',
          wageHike: 0,
        };
      }
      return { newState: 0, message: 'Normal operations.', wageHike: 0 };
    }

    case 1: {
      if (strset === 1) {
        return {
          newState: 0,
          message: `Warning resolved pre-emptively. Wage hike: Rs ${W[1]}/unit`,
          wageHike: W[1],
        };
      }
      return {
        newState: 2,
        message: 'First settlement offer issued.',
        wageHike: 0,
      };
    }

    case 2: {
      if (strset === 1) {
        return {
          newState: 0,
          message: `Strike settled at first offer. Wage hike: Rs ${W[1]}/unit`,
          wageHike: W[1],
        };
      }
      return {
        newState: 3,
        message: 'First offer rejected. Escalating.',
        wageHike: 0,
      };
    }

    case 3: {
      if (strset === 1) {
        return {
          newState: 0,
          message: `Strike settled at second offer. Wage hike: Rs ${W[2]}/unit`,
          wageHike: W[2],
        };
      }
      return {
        newState: 4,
        message: 'Second offer rejected. Strike called.',
        wageHike: 0,
      };
    }

    case 4: {
      return {
        newState: 5,
        message: 'STRIKE IN PROGRESS. Zero production this quarter.',
        wageHike: W[3],
      };
    }

    case 5: {
      return {
        newState: 0,
        message: `Tribunal decree: mandatory wage hike Rs ${W[4]}/unit applied.`,
        wageHike: W[4],
      };
    }

    default:
      return {
        newState: 0,
        message: 'Unknown strike state — reset to normal.',
        wageHike: 0,
      };
  }
}

/**
 * Process events (strikes, extraordinary items, export incentives) for a
 * single team. Returns the new strike state and all dependent outputs
 * that downstream modules need (labour cost adder, production factor,
 * P&L extraordinary item, export incentive).
 *
 * @param input - Team decision, previous strike state, forecast, game config
 * @returns Updated strike state, wage hike, production factor, incentives
 */
export async function runEventModule(
  input: EventModuleInput,
): Promise<EventModuleOutput> {
  const {
    teamNo,
    decision,
    prevStrikeState,
    prevTotalProduction = 0,
    forecast,
    gameaid,
    randomFactor,
  } = input;

  const warningProbability = (gameaid.strikea1o ?? 0) / 100;
  const rnd = randomFactor ?? Math.random();

  const transition = advanceStrikeState(
    prevStrikeState,
    decision.strset,
    warningProbability,
    rnd,
  );

  const productionFactor =
    PRODUCTION_FACTOR_BY_STATE[prevStrikeState] ?? 1.0;
  const isOnStrike = prevStrikeState === 4;

  // Additional labour cost is sized against the team's most recent production
  // volume. If not supplied (first quarter), the adder degenerates to zero and
  // will simply surface as a wageHike per-unit value for downstream modules.
  const additionalLaborCost = transition.wageHike * prevTotalProduction;

  // Strike cost buckets — STRIKEA covers the wage-hike impact, STRIKEB is
  // reserved for go-slow / productivity loss (future work).
  const strikeCostA = additionalLaborCost;
  const strikeCostB = 0;

  const extraordinaryAmount = forecast.extitem ?? 0;

  const exportIncentive =
    forecast.expoinc1 +
    forecast.expoinc2 +
    forecast.expoinc3 +
    forecast.expoinc4;

  return {
    teamNo,
    prevStrikeState,
    newStrikeState: transition.newState,
    strikeMessage: transition.message,
    wageHike: transition.wageHike,
    additionalLaborCost,
    productionFactor,
    isOnStrike,
    extraordinaryAmount,
    exportIncentive,
    strikeCostA,
    strikeCostB,
  };
}

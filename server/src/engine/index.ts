/**
 * Engine barrel export — single import point for the simulation engine.
 *
 * Usage:
 *   import { processQuarter, ENGINE_CONSTANTS } from './engine';
 *   import type { QuarterEngineInput, QuarterEngineOutput } from './engine';
 */

// Orchestrator
export { processQuarter } from './SimulationEngine';

// Constants
export { ENGINE_CONSTANTS } from './constants';
export type { EngineConstants } from './constants';

// All types
export type {
  // Config / scenario
  GameAidConfig,
  ForecastParams,
  ProdsConfig,
  // Team decision
  TeamDecision,
  // State
  CapacityState,
  SaleState,
  FinancialState,
  // Top-level I/O
  QuarterEngineInput,
  QuarterEngineOutput,
  // Module-specific I/O
  CapacityModuleInput,
  CapacityModuleOutput,
  DemandModuleInput,
  DemandModuleOutput,
  ProductionModuleInput,
  ProductionModuleOutput,
  ProductionTeamResult,
  CostModuleInput,
  CostModuleOutput,
  CostTeamResult,
  ContractModuleInput,
  ContractModuleOutput,
  CashFlowModuleInput,
  CashFlowModuleOutput,
  FinancialModuleInput,
  FinancialModuleOutput,
  LoanEntry,
  LoanModuleInput,
  LoanModuleOutput,
  ValuationModuleInput,
  ValuationModuleOutput,
  EventModuleInput,
  EventModuleOutput,
} from './types';

// Individual modules (for testing or direct invocation)
export { runCapacityModule } from './CapacityModule';
export { runDemandModule } from './DemandModule';
export { runProductionModule } from './ProductionModule';
export { runCostModule } from './CostModule';
export { runContractModule } from './ContractModule';
export { runCashFlowModule } from './CashFlowModule';
export { runFinancialModule } from './FinancialModule';
export { runLoanModule } from './LoanModule';
export { runValuationModule } from './ValuationModule';
export { runEventModule } from './EventModule';

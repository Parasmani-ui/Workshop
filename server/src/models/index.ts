/**
 * Models barrel export
 * Re-exports all Mongoose models, document interfaces, and sub-schema interfaces.
 */

export { Game } from './Game.model';
export type { IGame, IGameDocument } from './Game.model';

export { Team } from './Team.model';
export type { ITeam, ITeamDocument } from './Team.model';

export { Decision } from './Decision.model';
export type { IDecision, IDecisionDocument } from './Decision.model';

export { QuarterOutput } from './QuarterOutput.model';
export type {
  IQuarterOutput,
  IQuarterOutputDocument,
  IPandL,
  IBSheet,
  ICashTab,
  ISaleData,
  ICapTab,
  IOpTable,
} from './QuarterOutput.model';

export { Scenario } from './Scenario.model';
export type {
  IScenario,
  IScenarioDocument,
  IGameAid,
  IProdsTraiField,
  IForecast,
} from './Scenario.model';

export { LoanMaster, LoanDetail } from './LoanMaster.model';
export type {
  ILoanMaster,
  ILoanMasterDocument,
  ILoanDetail,
  ILoanDetailDocument,
} from './LoanMaster.model';

export { CapitalAsset } from './CapitalAsset.model';
export type { ICapitalAsset, ICapitalAssetDocument } from './CapitalAsset.model';

export { User } from './User.model';
export type { IUser, IUserDocument } from './User.model';

import type { UserRef } from '../../../core/auth/models/user-ref.interface';

/** OPP-09 Opportunity Team: roles filled as the workflow progresses. */
export interface OpportunityTeam {
  pmId?: UserRef | string | null;
  engineerId?: UserRef | string | null;
  techLeadId?: UserRef | string | null;
  financialPreparerId?: UserRef | string | null;
}

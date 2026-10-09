import type { CompletenessResult } from '../../../shared/crm/completeness-panel/completeness-result.interface';
import type { JourneyMilestone } from './journey-milestone.interface';
import type { Opportunity } from './opportunity.interface';
import type { ReadinessItem } from './readiness-item.interface';

/** `GET /opportunities/:id` response. */
export interface OpportunityDetail {
  opportunity: Opportunity;
  completeness: CompletenessResult;
  readiness: ReadinessItem[];
  journey: JourneyMilestone[];
  canViewFinancials: boolean;
}

import type { CompletenessResult } from '../../../shared/crm/completeness-panel/completeness-result.interface';
import type { Lead } from './lead.interface';

/** `GET /leads/:id` response. */
export interface LeadDetail {
  lead: Lead;
  completeness: CompletenessResult;
  slaState: Lead['slaState'];
  /** Server verdict: edit permission in record scope at this stage (what `PATCH /leads/:id` checks). */
  canEdit?: boolean;
}

import type { CompletenessResult } from '../../../shared/crm/completeness-panel/completeness-result.interface';
import type { Customer } from './customer.interface';

/** `GET /customers/:id` response. */
export interface CustomerDetail {
  customer: Customer;
  completeness: CompletenessResult;
  /** Server verdict: edit permission within record scope, and not merged away (what `PATCH` checks). */
  canEdit?: boolean;
}

import type { CompletenessResult } from '../../../shared/crm/completeness-panel/completeness-result.interface';
import type { Customer } from './customer.interface';

/** `GET /customers/:id` response. */
export interface CustomerDetail {
  customer: Customer;
  completeness: CompletenessResult;
}

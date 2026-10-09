import type { OpportunityFields } from './opportunity-fields.interface';

/** `POST /opportunities` payload. */
export interface CreateOpportunityPayload extends OpportunityFields {
  /** DUP-08: the user saw a similar open opportunity and still wants a new one. */
  confirmDuplicate?: boolean;
}

import type { CustomerDuplicateMatch } from './customer-duplicate-match.interface';
import type { LeadDuplicateMatch } from './lead-duplicate-match.interface';

/** DUP-01/LEAD-07: the full 409 `errors.possibleDuplicates` response body. */
export interface DuplicateMatches {
  customerMatches: CustomerDuplicateMatch[];
  leadMatches: LeadDuplicateMatch[];
}

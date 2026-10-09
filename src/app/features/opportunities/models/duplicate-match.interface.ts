import type { UserRef } from '../../../core/auth/models/user-ref.interface';

/** DUP-08: an existing open opportunity for the same customer/site/solution type. */
export interface DuplicateMatch {
  id: string;
  opportunityNo: string;
  name: string;
  stage: string;
  ownerId: UserRef | string | null;
}

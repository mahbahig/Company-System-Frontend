import type { LeadFields } from './lead-fields.interface';

/** `POST /leads` payload: full fields, an optional owner, and duplicate confirmation. */
export interface CreateLeadPayload extends LeadFields {
  ownerId?: string;
  confirmDuplicate?: boolean;
}

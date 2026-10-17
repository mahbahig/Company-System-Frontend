import type { LeadFields } from './lead-fields.interface';

/**
 * `POST /leads` payload: full fields, an optional owner, and duplicate
 * confirmation. No qualification: it is recorded on the lead afterwards (its
 * edit), never at creation; the API drops it from a create.
 */
export interface CreateLeadPayload extends Omit<LeadFields, 'qualification'> {
  ownerId?: string;
  confirmDuplicate?: boolean;
}

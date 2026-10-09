import type { LeadFields } from './lead-fields.interface';

/** `PATCH /leads/:id` payload: every field optional. */
export type UpdateLeadPayload = Partial<LeadFields>;

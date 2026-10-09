/** DUP-01/LEAD-07: a possible duplicate lead returned by the 409 `errors.possibleDuplicates` response. */
export interface LeadDuplicateMatch {
  leadId: string;
  leadNo?: string;
  name?: string;
}

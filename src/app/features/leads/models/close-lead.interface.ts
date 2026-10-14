/** `POST /leads/:id/close` payload, mirrors `CloseLeadSchema` (structured closure reasons). */
export interface CloseLeadPayload {
  reason: 'not_a_fit' | 'unreachable' | 'duplicate' | 'invalid_spam' | 'nurture' | 'other';
  comment?: string;
  nurtureFollowUpAt?: string;
  qualityCode?: string;
}

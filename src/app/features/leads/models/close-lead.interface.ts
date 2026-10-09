/** `POST /leads/:id/close` payload, mirrors `CloseLeadSchema`. */
export interface CloseLeadPayload {
  reason: 'unqualified' | 'invalid' | 'duplicate' | 'nurture';
  comment?: string;
  nurtureFollowUpAt?: string;
  qualityCode?: string;
}

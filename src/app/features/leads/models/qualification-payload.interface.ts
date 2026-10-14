/** `POST /leads/:id/qualify` payload: the explicit L3 outcome with the conversation summary. */
export interface QualificationPayload {
  outcome: 'qualified' | 'nurture' | 'disqualified' | 'escalated';
  conversationSummary: string;
  nextAction?: string;
  nextFollowUpAt?: string;
  revisitAt?: string;
  disqualifyReason?: 'not_a_fit' | 'invalid_spam' | 'other';
  comment?: string;
}

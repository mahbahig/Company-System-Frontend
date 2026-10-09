/** `POST /leads/:id/attempts` payload, mirrors `LogAttemptSchema`. */
export interface LogAttemptPayload {
  reached: boolean;
  notes?: string;
  nextFollowUpAt?: string;
  nextAction?: string;
}

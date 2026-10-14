/** `POST /leads/:id/attempts` payload, mirrors `LogAttemptSchema`. */
export interface LogAttemptPayload {
  channel: 'call' | 'whatsapp' | 'sms' | 'email' | 'visit' | 'other';
  outcome: 'reached' | 'no_answer' | 'busy' | 'wrong_number' | 'callback_requested' | 'message_left' | 'opted_out';
  notes?: string;
  /** Required unless the outcome is terminal (reached, wrong number, opted out). */
  nextAttemptAt?: string;
  nextAction?: string;
}

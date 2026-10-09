import type { UserRef } from '../../../core/auth/models/user-ref.interface';

/** One entry of `GET /leads/:id/timeline` (backend `timeline` module). */
export interface LeadTimelineEvent {
  id: string;
  type: string;
  actor?: UserRef | string | null;
  at: string;
  data?: Record<string, unknown>;
}

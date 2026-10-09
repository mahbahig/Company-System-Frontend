import type { UserRef } from '../../../core/auth/models/user-ref.interface';

/** OPP-05 stage history entry; entries are never edited once written. */
export interface StageHistoryEntry {
  fromStage?: string | null;
  toStage: string;
  enteredAt: string;
  exitedAt?: string | null;
  changedBy: UserRef | string;
  reason?: string;
  override?: { reason: string; gates: string[] } | null;
}

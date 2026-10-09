/** `POST /opportunities/:id/stage` payload. */
export interface ChangeStagePayload {
  toStage: string;
  /** Required for backward moves and reopening. */
  reason?: string;
  lostReason?: { code: string; competitorCode?: string; competitorName?: string; comment?: string };
  /** Authorised override of failed gates, with a mandatory reason. */
  override?: { reason: string };
}

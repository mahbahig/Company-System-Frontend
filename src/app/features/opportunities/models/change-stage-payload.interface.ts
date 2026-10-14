/**
 * `POST /opportunities/:id/stage` payload. Only the manual moves exist here:
 * O0 → O1 with the confirmed need, any open stage → Lost with a structured
 * reason, Lost → Discovery (reopen, with a reason). Every other stage is
 * entered by its business action; there are no gate overrides.
 */
export interface ChangeStagePayload {
  toStage: string;
  reason?: string;
  lostReason?: {
    code: string;
    competitorCode?: string;
    competitorName?: string;
    comment?: string;
    finalFeedback?: string;
    withdrawalCommunication?: string;
    reopenAt?: string;
  };
  needConfirmation?: { method: 'meeting' | 'call' | 'site_visit' | 'written' | 'other'; note: string };
}

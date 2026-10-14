/** The commercial deal track (D0–D7) carried by the opportunity. */
export interface Deal {
  dealNo: string;
  stage: string;
  financeHold?: { active: boolean; reasonCode?: string | null; note?: string | null; history?: unknown[] } | null;
  financeReadiness?: { depositStatus: string; note?: string; evidenceDocumentId?: string | null; confirmedAt?: string } | null;
  wonEvidence?: { contractId: string; contractVersion: number; documentId: string; verifiedBy?: string | null; verifiedAt?: string | null } | null;
}

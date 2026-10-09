/** `POST /leads/quick-add` payload, mirrors `QuickAddLeadSchema`. */
export interface QuickAddLeadPayload {
  name: string;
  phone: string;
  companyName?: string;
  governorateCode?: string;
  sourceCode: string;
  requestedServiceCode?: string;
  notes?: string;
  requirement?: string;
  logCall?: {
    outcomeCode: string;
    notes?: string;
    nextAction?: string;
    nextActionAt?: string;
  };
  confirmDuplicate?: boolean;
}

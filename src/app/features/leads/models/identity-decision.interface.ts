/** `POST /leads/:id/identity-review` payload (L1): unique, linked to a customer, or merged into a lead. */
export interface IdentityDecisionPayload {
  decision: 'unique' | 'linked' | 'merged';
  note?: string;
  linkCustomerId?: string;
  mergedIntoLeadId?: string;
}

/** One proposed allocation row from `POST /leads/distribute/preview`. */
export interface RoutingProposal {
  leadId: string;
  leadNo: string;
  leadName: string;
  ownerId: string | null;
  ownerNameAr?: string;
  ownerNameEn?: string;
  reason: string;
}

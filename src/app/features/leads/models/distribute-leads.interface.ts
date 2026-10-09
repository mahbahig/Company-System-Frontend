/** `POST /leads/distribute(/preview)` payload, mirrors `DistributeLeadsSchema`. */
export interface DistributeLeadsPayload {
  leadIds?: string[];
  allocation?: { leadId: string; ownerId: string }[];
}

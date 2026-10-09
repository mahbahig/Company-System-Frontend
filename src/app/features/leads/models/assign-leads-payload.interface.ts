/** `POST /leads/assign` payload. */
export interface AssignLeadsPayload {
  leadIds: string[];
  ownerId: string;
  reason: string;
  overrideCapacity?: boolean;
}

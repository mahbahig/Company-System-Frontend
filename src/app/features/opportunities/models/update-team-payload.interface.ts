/** `PATCH /opportunities/:id/team` payload — only the fields being changed. */
export interface UpdateTeamPayload {
  pmId?: string | null;
  engineerId?: string | null;
  techLeadId?: string | null;
  financialPreparerId?: string | null;
}

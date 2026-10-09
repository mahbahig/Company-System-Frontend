/** One business-history entry (backend `timeline_events`, TIME-01..07). */
export interface TimelineEvent {
  id: string;
  type: string;
  entityType?: string;
  entityId?: string;
  opportunityId?: string;
  opportunityLabel?: string;
  data: Record<string, unknown>;
  actorNameAr?: string;
  actorNameEn?: string;
  occurredAt: string;
}

/** Parent resources that expose `GET /<plural>/:id/timeline` (TIME-01/02/04). */
export type TimelineEntityType = 'customer' | 'opportunity' | 'lead' | 'project';

export const TIMELINE_ENTITY_PATH: Record<TimelineEntityType, string> = {
  customer: 'customers',
  opportunity: 'opportunities',
  lead: 'leads',
  project: 'projects',
};

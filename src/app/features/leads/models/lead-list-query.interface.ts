/** Query for `GET /leads` (mirrors the backend `LeadListQueryDto`). */
export interface LeadListQuery {
  q?: string;
  status?: string;
  intakeMode?: string;
  source?: string;
  campaign?: string;
  priority?: string;
  governorate?: string;
  category?: string;
  ownerId?: string;
  sla?: string;
  unassigned?: boolean;
  includeClosed?: boolean;
  page?: number;
  pageSize?: number;
  missing?: string;
}

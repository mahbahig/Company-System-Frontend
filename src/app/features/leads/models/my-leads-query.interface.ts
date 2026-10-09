/** Query for `GET /leads/mine` (mirrors the backend `MyLeadsQueryDto`). */
export interface MyLeadsQuery {
  q?: string;
  tab: 'new' | 'assigned' | 'self_sourced' | 'follow_ups_due' | 'nurture';
  page?: number;
  pageSize?: number;
}

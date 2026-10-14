/** Query for `GET /customers` (mirrors the backend CustomerListQuery). */
export interface CustomerListQuery {
  q?: string;
  status?: string;
  category?: string;
  governorate?: string;
  mine?: boolean;
  overdue?: boolean;
  /** Profile completion past its due date (Exception Center drill-down). */
  enrichmentOverdue?: boolean;
  page?: number;
  pageSize?: number;
  missing?: string;
}

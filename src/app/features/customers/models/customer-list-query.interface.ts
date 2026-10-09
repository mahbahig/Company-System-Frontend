/** Query for `GET /customers` (mirrors the backend CustomerListQuery). */
export interface CustomerListQuery {
  q?: string;
  status?: string;
  category?: string;
  governorate?: string;
  mine?: boolean;
  overdue?: boolean;
  page?: number;
  pageSize?: number;
  missing?: string;
}

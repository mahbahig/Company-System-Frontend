/** One page of a list endpoint (backend `Page<T>`). */
export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

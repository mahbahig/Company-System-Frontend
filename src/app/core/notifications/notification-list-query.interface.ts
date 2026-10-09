/** Query params accepted by `GET /notifications`. */
export interface NotificationListQuery {
  unread?: boolean;
  category?: string;
  page?: number;
  pageSize?: number;
}

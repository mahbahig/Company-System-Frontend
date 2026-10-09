/** Body for `POST /tasks` (mirrors the backend CreateTaskDto). */
export interface CreateTaskRequest {
  title: string;
  description?: string;
  assigneeId?: string;
  priority?: string;
  dueAt?: string;
  reminderAt?: string;
  customerId?: string;
  leadId?: string;
  opportunityId?: string;
}

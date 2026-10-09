/** Body for `PATCH /tasks/:id` (mirrors the backend UpdateTaskDto). */
export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  assigneeId?: string;
  priority?: string;
  dueAt?: string | null;
  reminderAt?: string | null;
}

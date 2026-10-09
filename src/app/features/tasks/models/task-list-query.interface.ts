import type { TaskStatus, TaskView } from './task.interface';

/** Query for `GET /tasks` (mirrors the backend TaskListQueryDto). */
export interface TaskListQuery {
  q?: string;
  view?: TaskView;
  status?: TaskStatus;
  priority?: string;
  assigneeId?: string;
  customerId?: string;
  leadId?: string;
  opportunityId?: string;
  page?: number;
  pageSize?: number;
}

import type { UserRef } from '../../../core/auth/models/user-ref.interface';

/** `dueAt` in the past with the task still open — computed client-side, never stored. */
export type TaskStatus = 'open' | 'in_progress' | 'waiting' | 'done' | 'cancelled';

export type TaskView = 'mine' | 'team' | 'overdue' | 'today' | 'upcoming' | 'all';

/** A follow-up / reminder task (backend `tasks`), as list and detail endpoints return it. */
export interface Task {
  id: string;
  title: string;
  description?: string;
  /** Populated on list/detail; a bare id elsewhere. */
  assigneeId: UserRef | string;
  teamId?: string | null;
  priority: string;
  status: TaskStatus;
  dueAt?: string | null;
  reminderAt?: string | null;
  customerId?: string | null;
  leadId?: string | null;
  opportunityId?: string | null;
  actionUrl?: string;
  isSystemGenerated: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  completedBy?: UserRef | string | null;
  completionNotes?: string;
  cancellationReason?: string;
  createdBy: UserRef | string;
  createdAt: string;
  updatedAt: string;
}

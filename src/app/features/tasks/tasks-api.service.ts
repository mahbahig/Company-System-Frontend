import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { CancelTaskRequest } from './models/cancel-task-request.interface';
import type { CompleteTaskRequest } from './models/complete-task-request.interface';
import type { CreateTaskRequest } from './models/create-task-request.interface';
import type { TaskListQuery } from './models/task-list-query.interface';
import type { Task } from './models/task.interface';
import type { UpdateTaskRequest } from './models/update-task-request.interface';

/** Typed client for the tasks endpoints. */
@Service()
export class TasksApi {
  private readonly api = inject(ApiService);

  list(query: TaskListQuery): Observable<Page<Task>> {
    return this.api.get<Page<Task>>('tasks', { ...query });
  }

  get(id: string): Observable<Task> {
    return this.api.get<Task>(`tasks/${id}`);
  }

  create(body: CreateTaskRequest): Observable<Task> {
    return this.api.post<Task>('tasks', body);
  }

  update(id: string, body: UpdateTaskRequest): Observable<Task> {
    return this.api.patch<Task>(`tasks/${id}`, body);
  }

  start(id: string): Observable<Task> {
    return this.api.post<Task>(`tasks/${id}/start`);
  }

  complete(id: string, body: CompleteTaskRequest): Observable<Task> {
    return this.api.post<Task>(`tasks/${id}/complete`, body);
  }

  cancel(id: string, body: CancelTaskRequest): Observable<Task> {
    return this.api.post<Task>(`tasks/${id}/cancel`, body);
  }
}

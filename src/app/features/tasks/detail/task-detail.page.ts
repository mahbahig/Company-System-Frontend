import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { required, form, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import type { BadgeTone } from '../../../shared/ui/badge/badge-variants';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CardContentDirective } from '../../../shared/ui/card/card-content.directive';
import { CardFooterDirective } from '../../../shared/ui/card/card-footer.directive';
import { CardHeaderDirective } from '../../../shared/ui/card/card-header.directive';
import { CardTitleDirective } from '../../../shared/ui/card/card-title.directive';
import { CardDirective } from '../../../shared/ui/card/card.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { TextareaDirective } from '../../../shared/ui/form/textarea.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { StatusPageComponent } from '../../errors/status-page.component';
import { asUserRef } from '../../../shared/utils/display-name';
import { isOverdue } from '../../../shared/utils/format';
import { TasksApi } from '../tasks-api.service';
import type { TaskStatus } from '../models/task.interface';
import { FormField } from '@angular/forms/signals';
const STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  open: 'neutral',
  in_progress: 'info',
  waiting: 'warning',
  done: 'success',
  cancelled: 'danger',
};

/** Task detail: start / complete(notes) / cancel(reason), per SRS §8.8. */
@Component({
  selector: 'app-task-detail-page',
  imports: [
    RouterLink,
    TranslatePipe,
    PageHeaderComponent,
    DetailItemComponent,
    AlertComponent,
    BadgeComponent,
    ButtonDirective,
    LabelComponent,
    InputDirective,
    TextareaDirective,
    StatusPageComponent,
    CardDirective,
    CardHeaderDirective,
    CardTitleDirective,
    CardContentDirective,
    CardFooterDirective,
    FormField,
  ],
  templateUrl: './task-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class TaskDetailPage {
  private readonly tasksApi = inject(TasksApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  /** Route param. */
  readonly id = input.required<string>();

  protected readonly statusTone = STATUS_TONE;
  protected readonly errorKey = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly showComplete = signal(false);
  protected readonly showCancel = signal(false);

  protected readonly detail = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.tasksApi.get(params),
  });
  protected readonly notFound = computed(() => {
    const error = this.detail.error();
    return ApiError.is(error) && (error.status === 404 || error.status === 400);
  });
  protected readonly task = computed(() => (this.detail.hasValue() ? this.detail.value() : null));

  protected readonly ownerName = computed(() => {
    const owner = asUserRef(this.task()?.assigneeId);
    return owner
      ? this.i18n.pick(owner.fullNameAr, owner.fullNameEn)
      : this.i18n.t('crm.common.unassigned');
  });
  protected readonly completedByName = computed(() => {
    const user = asUserRef(this.task()?.completedBy);
    return user ? this.i18n.pick(user.fullNameAr, user.fullNameEn) : null;
  });
  protected readonly isOverdue = computed(() => {
    const task = this.task();
    return !!task && task.status !== 'done' && task.status !== 'cancelled' && isOverdue(task.dueAt);
  });
  protected readonly canAct = computed(() => {
    const task = this.task();
    return (
      !!task && task.status !== 'done' && task.status !== 'cancelled' && this.auth.can('tasks.edit')
    );
  });

  private readonly completeModel = signal({ completionNotes: '' });
  protected readonly completeForm = form(this.completeModel);

  private readonly cancelModel = signal({ reason: '' });
  protected readonly cancelForm = form(this.cancelModel, (path) => {
    required(path.reason, { message: 'crm.validation.cancellationReasonRequired' });
  });

  protected statusLabel(status: TaskStatus): string {
    return this.i18n.t('crm.tasks.status.' + status);
  }

  protected async start(): Promise<void> {
    this.errorKey.set(null);
    this.busy.set(true);
    try {
      await firstValueFrom(this.tasksApi.start(this.id()));
      this.detail.reload();
    } catch (error) {
      this.errorKey.set(this.messageFor(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async submitComplete(event: Event): Promise<void> {
    event.preventDefault();
    this.errorKey.set(null);
    await submit(this.completeForm, async () => {
      this.busy.set(true);
      try {
        await firstValueFrom(this.tasksApi.complete(this.id(), this.completeModel()));
        this.showComplete.set(false);
        this.completeModel.set({ completionNotes: '' });
        this.detail.reload();
      } catch (error) {
        this.errorKey.set(this.messageFor(error));
      } finally {
        this.busy.set(false);
      }
      return undefined;
    });
  }

  protected async submitCancel(event: Event): Promise<void> {
    event.preventDefault();
    this.errorKey.set(null);
    this.cancelForm().markAsTouched();
    await submit(this.cancelForm, async () => {
      this.busy.set(true);
      try {
        await firstValueFrom(this.tasksApi.cancel(this.id(), this.cancelModel()));
        this.showCancel.set(false);
        this.cancelModel.set({ reason: '' });
        this.detail.reload();
      } catch (error) {
        this.errorKey.set(this.messageFor(error));
      } finally {
        this.busy.set(false);
      }
      return undefined;
    });
  }

  protected cancelReasonError(): string | null {
    const state = this.cancelForm.reason();
    return state.touched() ? (state.errors()[0]?.message ?? null) : null;
  }

  private messageFor(error: unknown): string {
    if (!ApiError.is(error)) return 'errors.unexpected';
    return this.i18n.has(error.messageKey) ? error.messageKey : 'errors.unexpected';
  }
}

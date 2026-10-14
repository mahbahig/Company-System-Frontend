import { Component, ElementRef, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { UnsavedChanges, type HasUnsavedChanges } from '../../../core/forms/unsaved-changes';
import { SaveShortcutDirective } from '../../../core/shortcuts/save-shortcut.directive';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { focusFirstInvalid } from '../../../shared/utils/focus-invalid';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { RecordPickerComponent } from '../../../shared/crm/record-picker/record-picker.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CardContentDirective } from '../../../shared/ui/card/card-content.directive';
import { CardDirective } from '../../../shared/ui/card/card.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { SelectDirective } from '../../../shared/ui/form/select.directive';
import { TextareaDirective } from '../../../shared/ui/form/textarea.directive';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { fromDatetimeLocal, toDatetimeLocal } from './datetime-local';
import type { TaskFormModel } from './task-form-model.interface';
import { TasksApi } from '../tasks-api.service';

const EMPTY_MODEL: TaskFormModel = {
  title: '',
  description: '',
  priority: 'normal',
  dueAt: '',
  reminderAt: '',
  assigneeId: '',
  customerId: '',
  leadId: '',
  opportunityId: '',
};

/** Create/edit a task (SRS §8.8 `/tasks/new`, `/tasks/:id/edit`). */
@Component({
  selector: 'app-task-form-page',
  imports: [
    RouterLink,
    SaveShortcutDirective,
    BreadcrumbsComponent,
    RecordPickerComponent,
    FormField,
    TranslatePipe,
    PageHeaderComponent,
    AlertComponent,
    ButtonDirective,
    LabelComponent,
    InputDirective,
    TextareaDirective,
    SelectComponent,
    SelectDirective,
    CardDirective,
    CardContentDirective,
  ],
  templateUrl: './task-form.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class TaskFormPage implements HasUnsavedChanges {
  private readonly tasksApi = inject(TasksApi);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  /** Route param; present only in edit mode. */
  readonly id = input<string>();
  /** Prefill from `?customerId=&opportunityId=&leadId=` (quick actions on a record). */
  readonly customerId = input<string>();
  readonly opportunityId = input<string>();
  readonly leadId = input<string>();

  protected readonly editing = computed(() => !!this.id());
  protected readonly canAssign = computed(() => this.auth.can('tasks.assign'));
  protected readonly errorKey = signal<string | null>(null);

  protected readonly existing = rxResource({
    params: () => this.id(),
    stream: ({ params }) => (params ? this.tasksApi.get(params) : of(undefined)),
  });

  private readonly model = signal<TaskFormModel>({ ...EMPTY_MODEL });
  protected readonly taskForm = form(this.model, (path) => {
    required(path.title, { message: 'crm.validation.titleRequired' });
    maxLength(path.title, 200);
    maxLength(path.description, 4000);
  });

  private saved = false;
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('navigation.items.tasks'), path: '/tasks' },
    ...(this.existing.value() ? [{ label: this.existing.value()!.title, path: `/tasks/${this.id()}` }] : []),
    { label: this.i18n.t(this.editing() ? 'crm.tasks.editTitle' : 'crm.tasks.newTitle') },
  ]);

  hasUnsavedChanges(): boolean {
    return !this.saved && this.taskForm().dirty();
  }

  constructor() {
    void this.reference.load();
    inject(UnsavedChanges).track(() => this.hasUnsavedChanges());
    effect(() => {
      const customerId = this.customerId();
      const opportunityId = this.opportunityId();
      const leadId = this.leadId();
      if (this.id()) return;
      this.model.update((m) => ({ ...m, customerId: customerId ?? m.customerId, opportunityId: opportunityId ?? m.opportunityId, leadId: leadId ?? m.leadId }));
    });
    effect(() => {
      const task = this.existing.value();
      if (!task) return;
      this.model.set({
        title: task.title,
        description: task.description ?? '',
        priority: task.priority,
        dueAt: toDatetimeLocal(task.dueAt),
        reminderAt: toDatetimeLocal(task.reminderAt),
        assigneeId: '',
        customerId: task.customerId ?? '',
        leadId: task.leadId ?? '',
        opportunityId: task.opportunityId ?? '',
      });
    });
  }

  protected setLink(key: 'customerId' | 'leadId' | 'opportunityId', value: string): void {
    this.model.update((m) => ({ ...m, [key]: value }));
  }

  protected fieldError(field: 'title' | 'description'): string | null {
    const state = this.taskForm[field]();
    return state.touched() ? (state.errors()[0]?.message ?? null) : null;
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.taskForm().submitting()) return;
    this.errorKey.set(null);
    this.taskForm().markAsTouched();
    if (this.taskForm().invalid()) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }

    const value = this.model();
    const dueAt = fromDatetimeLocal(value.dueAt);
    const reminderAt = fromDatetimeLocal(value.reminderAt);
    if (dueAt && reminderAt && reminderAt > dueAt) {
      this.errorKey.set('crm.validation.reminderAfterDue');
      return;
    }

    await submit(this.taskForm, async () => {
      try {
        const id = this.id();
        if (id) {
          await firstValueFrom(
            this.tasksApi.update(id, {
              title: value.title,
              description: value.description || undefined,
              priority: value.priority || undefined,
              dueAt: dueAt ?? null,
              reminderAt: reminderAt ?? null,
              ...(this.canAssign() && value.assigneeId ? { assigneeId: value.assigneeId } : {}),
            }),
          );
          await this.navigateToDetail(id);
        } else {
          const created = await firstValueFrom(
            this.tasksApi.create({
              title: value.title,
              description: value.description || undefined,
              priority: value.priority || undefined,
              dueAt,
              reminderAt,
              ...(this.canAssign() && value.assigneeId ? { assigneeId: value.assigneeId } : {}),
              customerId: value.customerId || undefined,
              leadId: value.leadId || undefined,
              opportunityId: value.opportunityId || undefined,
            }),
          );
          await this.navigateToDetail(created.id);
        }
      } catch (error) {
        this.errorKey.set(this.messageFor(error));
      }
      return undefined;
    });
  }

  private async navigateToDetail(id: string): Promise<void> {
    this.saved = true;
    await this.router.navigate(['/', this.i18n.locale(), 'tasks', id]);
  }

  private messageFor(error: unknown): string {
    if (!ApiError.is(error)) return 'errors.unexpected';
    return this.i18n.has(error.messageKey) ? error.messageKey : 'errors.unexpected';
  }
}

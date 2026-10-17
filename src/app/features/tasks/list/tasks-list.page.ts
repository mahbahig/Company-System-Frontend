import { Component, computed, effect, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SavedViewsBarComponent } from '../../../shared/crm/saved-views/saved-views-bar.component';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import type { BadgeTone } from '../../../shared/ui/badge/badge-variants';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TableBodyDirective } from '../../../shared/ui/table/table-body.directive';
import { TableCellDirective } from '../../../shared/ui/table/table-cell.directive';
import { TableEmptyComponent } from '../../../shared/ui/table/table-empty.component';
import { TableHeadDirective } from '../../../shared/ui/table/table-head.directive';
import { TableHeaderDirective } from '../../../shared/ui/table/table-header.directive';
import { TableRowDirective } from '../../../shared/ui/table/table-row.directive';
import { TableWrapperComponent } from '../../../shared/ui/table/table-wrapper.component';
import { TableDirective } from '../../../shared/ui/table/table.directive';
import { asUserRef } from '../../../shared/utils/display-name';
import { isOverdue } from '../../../shared/utils/format';
import { TasksApi } from '../tasks-api.service';
import type { Task, TaskStatus, TaskView } from '../models/task.interface';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ShortcutDirective } from '../../../core/shortcuts/shortcut.directive';
import { RowLinkDirective } from '../../../shared/ui/table/row-link.directive';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';
import { PageSizeSelectComponent } from '../../../shared/crm/pagination/page-size-select.component';

const VIEWS: TaskView[] = ['mine', 'team', 'overdue', 'today', 'upcoming', 'all'];
const STATUSES: TaskStatus[] = ['open', 'in_progress', 'waiting', 'done', 'cancelled'];
const STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  open: 'neutral',
  in_progress: 'info',
  waiting: 'warning',
  done: 'success',
  cancelled: 'danger',
};

/**
 * Tasks list — the SRS views as tabs (mine/team/overdue/today/upcoming/all) plus status/priority filters.
 * My Tasks is the default; Team Tasks is only for team managers (the API refuses it to anyone else).
 */
@Component({
  selector: 'app-tasks-list-page',
  imports: [AvatarComponent, 
    RowLinkDirective,
    ShortcutDirective,
    SkeletonRowComponent,
    SavedViewsBarComponent,
    RouterLink,
    TranslatePipe,
    PageHeaderComponent,
    ListToolbarComponent,
    PaginationComponent,
    AlertComponent,
    BadgeComponent,
    ButtonDirective,
    TableWrapperComponent,
    TableDirective,
    TableHeaderDirective,
    TableBodyDirective,
    TableRowDirective,
    TableHeadDirective,
    TableCellDirective,
    TableEmptyComponent, CreateIconComponent, PageSizeSelectComponent],
  templateUrl: './tasks-list.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class TasksListPage {
  private readonly tasks = inject(TasksApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  // Query params (bound by the router).
  readonly q = input<string>();
  /** The tab asked for in the URL; absent (a plain /tasks) means My Tasks. */
  readonly view = input<string>();
  readonly status = input<string>();
  readonly priority = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  /**
   * Team Tasks: for a team manager whose task scope reaches the team — the API's own rule
   * (TasksService.canViewTeamTasks), from the team records, for any team.
   */
  protected readonly canSeeTeamTasks = computed(() => this.auth.managesTeam() && this.auth.can('tasks.view', 'team'));
  protected readonly views = computed(() => VIEWS.filter((view) => view !== 'team' || this.canSeeTeamTasks()));
  /** The open tab: the URL's when this user has it, otherwise My Tasks (no view, an unknown one, or Team for a member). */
  protected readonly activeView = computed<TaskView>(() => {
    const requested = this.view() as TaskView;
    return this.views().includes(requested) ? requested : 'mine';
  });
  protected readonly statusTone = STATUS_TONE;

  protected readonly result = rxResource({
    params: () => ({
      q: this.q(),
      view: this.activeView(),
      status: (this.status() as TaskStatus) || undefined,
      priority: this.priority(),
      page: this.page(), pageSize: this.pageSize(),
    }),
    stream: ({ params }) => this.tasks.list(params),
  });

  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly hasFilters = computed(() => !!(this.q() || this.status() || this.priority()));

  protected readonly filters = computed<FilterDefinition[]>(() => [
    {
      name: 'status',
      label: this.i18n.t('crm.tasks.columns.status'),
      options: STATUSES.map((code) => ({ value: code, label: this.i18n.t('crm.tasks.status.' + code) })),
      value: this.status() ?? '',
    },
    {
      name: 'priority',
      label: this.i18n.t('crm.tasks.columns.priority'),
      options: this.reference.options('task_priority'),
      value: this.priority() ?? '',
    },
  ]);

  constructor() {
    void this.reference.load();
    // A tab this user does not have (Team Tasks for a member, a typed or stale link) falls back to
    // My Tasks; drop it from the URL too, so a refresh or a bookmark opens My Tasks.
    effect(() => {
      const requested = this.view();
      if (requested && !this.views().includes(requested as TaskView))
        void this.router.navigate([], { relativeTo: this.route, queryParams: { view: null }, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }

  /** The assignee as a reference (for their picture), when the task has one. */
  protected ownerRef(task: Task) {
    return asUserRef(task.assigneeId);
  }

  protected ownerName(task: Task): string {
    const owner = asUserRef(task.assigneeId);
    return owner ? this.i18n.pick(owner.fullNameAr, owner.fullNameEn) : this.i18n.t('crm.common.unassigned');
  }

  protected overdue(task: Task): boolean {
    return task.status !== 'done' && task.status !== 'cancelled' && isOverdue(task.dueAt);
  }

  protected statusLabel(status: TaskStatus): string {
    return this.i18n.t('crm.tasks.status.' + status);
  }
}

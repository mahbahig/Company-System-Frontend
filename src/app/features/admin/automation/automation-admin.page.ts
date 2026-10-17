import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import type { Page } from '../../../core/api/page.interface';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';
import { LocalPager } from '../../../shared/crm/pagination/local-pager';
import { PagerComponent } from '../../../shared/crm/pagination/pager.component';

interface Definition {
  code: string;
  event: string;
  nameAr: string;
  nameEn: string;
  enabled: boolean;
  failed: number;
  succeeded: number;
}

interface Run {
  id: string;
  key: string;
  code: string;
  event: string;
  status: string;
  attempts: number;
  error?: string | null;
  skipReason?: string | null;
  createdAt: string;
  finishedAt?: string | null;
}

/**
 * AUTO-13 automation monitor: switch each automation on or off, see its
 * success / failure counts, inspect runs and retry failed ones.
 */
@Component({
  selector: 'app-automation-admin-page',
  imports: [SkeletonRowComponent, TranslatePipe, StatusBadgeComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS, PagerComponent],
  templateUrl: './automation-admin.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class AutomationAdminPage {
  private readonly api = inject(ApiService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly status = input<string>();
  readonly code = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly definitions = rxResource({ stream: () => this.api.get<{ rows: Definition[] }>('automation/definitions').pipe(map((b) => b.rows)) });
  /** The automation catalogue (defined in code), paged in memory. */
  protected readonly definitionsPager = new LocalPager(() => this.definitions.value());
  protected readonly runs = rxResource({ params: () => ({ status: this.status(), code: this.code(), page: this.page(), pageSize: this.pageSize() }), stream: ({ params }) => this.api.get<Page<Run>>('automation/runs', params) });
  protected readonly runRows = computed(() => (this.runs.hasValue() ? this.runs.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'status', label: this.i18n.t('admin.users.status'), options: ['running', 'succeeded', 'failed', 'skipped'].map((value) => ({ value, label: this.i18n.t(`enums.automationRunStatus.${value}`) })), value: this.status() ?? '' },
    { name: 'code', label: this.i18n.t('admin.code'), options: (this.definitions.value() ?? []).map((d) => ({ value: d.code, label: d.code })), value: this.code() ?? '' },
  ]);

  protected toggle(code: string, enabled: boolean): void {
    void this.actions.run(this.api.patch<{ rows: Definition[] }>(`automation/definitions/${code}`, { enabled }), 'admin.saved', (result) => this.definitions.set(result.rows));
  }

  protected retry(id: string): void {
    void this.actions.run(this.api.post(`automation/runs/${id}/retry`), 'admin.automation.retried', () => {
      this.runs.reload();
      this.definitions.reload();
    });
  }
}

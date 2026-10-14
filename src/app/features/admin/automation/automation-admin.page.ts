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
  imports: [SkeletonRowComponent, TranslatePipe, StatusBadgeComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'admin.automation.title' | t" [subtitle]="'admin.automation.subtitle' | t" class="!mb-0" />
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    @if (actions.error(); as text) {
      <app-alert variant="destructive">{{ text }}</app-alert>
    }
    <app-table-wrapper [label]="'admin.automation.definitions' | t" [attr.aria-busy]="definitions.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'admin.code' | t }}</th>
            <th appTableHead>{{ 'admin.automation.name' | t }}</th>
            <th appTableHead>{{ 'admin.automation.trigger' | t }}</th>
            <th appTableHead class="text-end">{{ 'admin.automation.succeeded' | t }}</th>
            <th appTableHead class="text-end">{{ 'admin.automation.failed' | t }}</th>
            <th appTableHead>{{ 'admin.active' | t }}</th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (d of definitions.value() ?? []; track d.code) {
            <tr appTableRow>
              <td appTableCell class="font-mono text-xs" dir="ltr">{{ d.code }}</td>
              <td appTableCell>{{ i18n.pick(d.nameAr, d.nameEn) }}</td>
              <td appTableCell class="font-mono text-xs" dir="ltr">{{ d.event }}</td>
              <td appTableCell class="tabular text-end">{{ i18n.formatNumber(d.succeeded) }}</td>
              <td appTableCell class="tabular text-end" [class.text-destructive]="d.failed > 0">{{ i18n.formatNumber(d.failed) }}</td>
              <td appTableCell>
                <input type="checkbox" [attr.aria-label]="d.code" [checked]="d.enabled" [disabled]="actions.busy()" (change)="toggle(d.code, $any($event.target).checked)" />
              </td>
            </tr>
          }
        </tbody>
      </table>
    </app-table-wrapper>

    <h2 class="text-lg font-semibold">{{ 'admin.automation.runs' | t }}</h2>
    <app-list-toolbar [searchValue]="''" [filters]="filters()" />
    <app-table-wrapper [label]="'admin.automation.runs' | t" [attr.aria-busy]="runs.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'admin.automation.when' | t }}</th>
            <th appTableHead>{{ 'admin.code' | t }}</th>
            <th appTableHead>{{ 'admin.users.status' | t }}</th>
            <th appTableHead class="text-end">{{ 'admin.automation.attempts' | t }}</th>
            <th appTableHead>{{ 'admin.automation.detail' | t }}</th>
            <th appTableHead><span class="sr-only">{{ 'admin.actions' | t }}</span></th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (run of runRows(); track run.id) {
            <tr appTableRow>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(run.createdAt, true) }}</td>
              <td appTableCell class="font-mono text-xs" dir="ltr">{{ run.code }}</td>
              <td appTableCell><app-status-badge enum="automationRunStatus" [value]="run.status" /></td>
              <td appTableCell class="tabular text-end">{{ run.attempts }}</td>
              <td appTableCell class="max-w-md truncate font-mono text-xs" dir="ltr" [attr.title]="run.error || run.skipReason || ''">{{ run.error || run.skipReason || '—' }}</td>
              <td appTableCell>
                @if (run.status === 'failed') {
                  <button type="button" appButton variant="outline" size="sm" [disabled]="actions.busy()" (click)="retry(run.id)">{{ 'admin.automation.retry' | t }}</button>
                }
              </td>
            </tr>
          } @empty {
            @if (runs.isLoading()) {
              @for (i of [0, 1, 2, 3, 4]; track i) {
                <tr app-skeleton-row [columns]="6" [index]="i"></tr>
              }
            } @else {
              <tr app-table-empty [colSpan]="6">{{ 'admin.empty' | t }}</tr>
            }
          }
        </tbody>
      </table>
    </app-table-wrapper>
    @if (runs.hasValue()) {
      <app-pagination [page]="runs.value().page" [pageCount]="runs.value().pageCount" [total]="runs.value().total" [pageSize]="runs.value().pageSize" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class AutomationAdminPage {
  private readonly api = inject(ApiService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly status = input<string>();
  readonly code = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly definitions = rxResource({ stream: () => this.api.get<{ rows: Definition[] }>('automation/definitions').pipe(map((b) => b.rows)) });
  protected readonly runs = rxResource({ params: () => ({ status: this.status(), code: this.code(), page: this.page() }), stream: ({ params }) => this.api.get<Page<Run>>('automation/runs', params) });
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

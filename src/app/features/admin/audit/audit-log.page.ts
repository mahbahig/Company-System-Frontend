import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { ApiService } from '../../../core/api/api.service';
import type { Page } from '../../../core/api/page.interface';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';

interface AuditEntry {
  id: string;
  createdAt: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  changedFields: string[];
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  source: string;
  severity: string;
  ip?: string;
}

/**
 * AUD-01..03 audit viewer: who changed what and when (before / after values),
 * filtered by record, action, severity, person and period. Read-only.
 */
@Component({
  selector: 'app-audit-log-page',
  imports: [SkeletonRowComponent, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, UserSelectComponent, AlertComponent, ButtonDirective, PageHeaderComponent, PaginationComponent, ...TABLE_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-page-header [heading]="'admin.audit.title' | t" [subtitle]="'admin.audit.subtitle' | t" class="!mb-0" />
    <form class="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4" (submit)="apply($event)" [attr.aria-label]="'admin.audit.filters' | t">
      <div>
        <label appLabel for="au-entity">{{ 'admin.audit.entityType' | t }}</label>
        <input appInput id="au-entity" dir="ltr" [value]="f().entityType" (input)="set('entityType', $any($event.target).value)" />
      </div>
      <div>
        <label appLabel for="au-entity-id">{{ 'admin.audit.entityId' | t }}</label>
        <input appInput id="au-entity-id" dir="ltr" [value]="f().entityId" (input)="set('entityId', $any($event.target).value)" />
      </div>
      <div>
        <label appLabel for="au-action">{{ 'admin.audit.action' | t }}</label>
        <input appInput id="au-action" dir="ltr" [value]="f().action" (input)="set('action', $any($event.target).value)" />
      </div>
      <div>
        <label appLabel for="au-severity">{{ 'admin.audit.severity' | t }}</label>
        <app-select>
          <select appSelect id="au-severity" [value]="f().severity" (change)="set('severity', $any($event.target).value)">
            <option value="">—</option>
            @for (s of ['info', 'warning', 'critical']; track s) {
              <option [value]="s">{{ s | enum: 'auditSeverity' }}</option>
            }
          </select>
        </app-select>
      </div>
      <div>
        <label appLabel for="au-actor">{{ 'admin.audit.actor' | t }}</label>
        <app-user-select inputId="au-actor" [value]="f().actorId" (valueChange)="set('actorId', $event)" />
      </div>
      <div>
        <label appLabel for="au-from">{{ 'analytics.filters.from' | t }}</label>
        <input appInput id="au-from" type="date" dir="ltr" [value]="f().from" (change)="set('from', $any($event.target).value)" />
      </div>
      <div>
        <label appLabel for="au-to">{{ 'analytics.filters.to' | t }}</label>
        <input appInput id="au-to" type="date" dir="ltr" [value]="f().to" (change)="set('to', $any($event.target).value)" />
      </div>
      <div class="flex items-end gap-2">
        <button type="submit" appButton size="sm">{{ 'analytics.filters.apply' | t }}</button>
        <button type="button" appButton variant="ghost" size="sm" (click)="clear()">{{ 'analytics.filters.clear' | t }}</button>
      </div>
    </form>
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    <app-table-wrapper [label]="'admin.audit.title' | t" [attr.aria-busy]="data.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'admin.automation.when' | t }}</th>
            <th appTableHead>{{ 'admin.audit.actor' | t }}</th>
            <th appTableHead>{{ 'admin.audit.action' | t }}</th>
            <th appTableHead>{{ 'admin.audit.record' | t }}</th>
            <th appTableHead>{{ 'admin.audit.changes' | t }}</th>
            <th appTableHead>{{ 'admin.audit.severity' | t }}</th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (row of rows(); track row.id) {
            <tr appTableRow>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(row.createdAt, true) }}</td>
              <td appTableCell>
                {{ row.actorName || '—' }}
                <span class="block text-xs text-muted-foreground">{{ row.source | enum: 'auditSource' }}</span>
              </td>
              <td appTableCell class="font-mono text-xs" dir="ltr">{{ row.action }}</td>
              <td appTableCell class="font-mono text-xs" dir="ltr">{{ row.entityType }}<span class="block text-muted-foreground">{{ row.entityId }}</span></td>
              <td appTableCell class="max-w-md text-xs">
                @if (row.changedFields.length) {
                  <button type="button" class="text-start text-primary hover:underline" (click)="expanded.set(expanded() === row.id ? null : row.id)">
                    {{ row.changedFields.slice(0, 6).join(', ') }}{{ row.changedFields.length > 6 ? '…' : '' }}
                  </button>
                  @if (expanded() === row.id) {
                    <div class="mt-2 flex flex-col gap-1" dir="ltr">
                      @for (field of row.changedFields; track field) {
                        <div class="rounded bg-muted p-1 font-mono">
                          <span class="font-semibold">{{ field }}:</span>
                          <span class="text-destructive line-through">{{ show(row.before, field) }}</span>
                          →
                          <span class="text-success">{{ show(row.after, field) }}</span>
                        </div>
                      }
                    </div>
                  }
                } @else {
                  —
                }
              </td>
              <td appTableCell><app-status-badge enum="auditSeverity" [value]="row.severity" /></td>
            </tr>
          } @empty {
            @if (data.isLoading()) {
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
    @if (data.hasValue()) {
      <app-pagination [page]="data.value().page" [pageCount]="data.value().pageCount" [total]="data.value().total" [pageSize]="data.value().pageSize" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class AuditLogPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  readonly entityType = input<string>();
  readonly entityId = input<string>();
  readonly action = input<string>();
  readonly severity = input<string>();
  readonly actorId = input<string>();
  readonly from = input<string>();
  readonly to = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly query = computed(() => ({
    entityType: this.entityType(),
    entityId: this.entityId(),
    action: this.action(),
    severity: this.severity(),
    actorId: this.actorId(),
    from: this.from(),
    to: this.to(),
    page: this.page(),
  }));
  protected readonly data = rxResource({ params: () => this.query(), stream: ({ params }) => this.api.get<Page<AuditEntry>>('audit', params) });
  protected readonly rows = computed(() => (this.data.hasValue() ? this.data.value().rows : []));
  protected readonly expanded = signal<string | null>(null);
  protected readonly f = signal({ entityType: '', entityId: '', action: '', severity: '', actorId: '', from: '', to: '' });

  constructor() {
    const q = this.query;
    queueMicrotask(() => {
      const current = q();
      this.f.set({
        entityType: current.entityType ?? '',
        entityId: current.entityId ?? '',
        action: current.action ?? '',
        severity: current.severity ?? '',
        actorId: current.actorId ?? '',
        from: current.from ?? '',
        to: current.to ?? '',
      });
    });
  }

  protected set(key: 'entityType' | 'entityId' | 'action' | 'severity' | 'actorId' | 'from' | 'to', value: string): void {
    this.f.update((f) => ({ ...f, [key]: value }));
  }

  protected apply(event: Event): void {
    event.preventDefault();
    const queryParams = Object.fromEntries(Object.entries(this.f()).map(([k, v]) => [k, v || null]));
    void this.router.navigate([], { queryParams: { ...queryParams, page: null }, queryParamsHandling: 'merge' });
  }

  protected clear(): void {
    this.f.set({ entityType: '', entityId: '', action: '', severity: '', actorId: '', from: '', to: '' });
    void this.router.navigate([], { queryParams: {} });
  }

  protected show(source: Record<string, unknown> | null | undefined, field: string): string {
    const value = source?.[field];
    if (value === undefined || value === null || value === '') return '∅';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return text.length > 120 ? text.slice(0, 120) + '…' : text;
  }
}

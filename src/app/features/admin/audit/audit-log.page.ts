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
import { applyWhenTypingStops } from '../../../shared/utils/live-search';

const FILTER_KEYS = ['entityType', 'entityId', 'action', 'severity', 'actorId', 'from', 'to'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
/** The filters as one comparable value (empty and absent are the same). */
const filterKey = (source: Partial<Record<FilterKey, string | undefined>>): string => JSON.stringify(FILTER_KEYS.map((key) => source[key] || ''));

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
 * filtered by record, action, severity, person and period — applied as the
 * user types (once typing pauses). Read-only.
 */
@Component({
  selector: 'app-audit-log-page',
  imports: [SkeletonRowComponent, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, UserSelectComponent, AlertComponent, ButtonDirective, PageHeaderComponent, PaginationComponent, ...TABLE_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './audit-log.page.html',
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
    applyWhenTypingStops(
      () => filterKey(this.f()),
      () => filterKey(this.query()),
      () => this.applyFilters(),
    );
  }

  protected set(key: FilterKey, value: string): void {
    this.f.update((f) => ({ ...f, [key]: value }));
  }

  protected apply(event: Event): void {
    event.preventDefault();
    this.applyFilters();
  }

  private applyFilters(): void {
    const queryParams = Object.fromEntries(Object.entries(this.f()).map(([k, v]) => [k, v || null]));
    // Refining filters replaces the history entry, so Back leaves the filtered view instead of replaying each pause.
    const refining = filterKey(this.query()) !== filterKey({});
    void this.router.navigate([], { queryParams: { ...queryParams, page: null }, queryParamsHandling: 'merge', replaceUrl: refining });
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

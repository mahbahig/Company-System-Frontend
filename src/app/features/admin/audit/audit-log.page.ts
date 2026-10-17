import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ChevronRight } from 'lucide';

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
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { applyWhenTypingStops } from '../../../shared/utils/live-search';
import type { AuditEntry } from './audit-entry.interface';
import { auditAction, auditActor, auditRecord, auditTime } from './audit-presenter';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';

const FILTER_KEYS = ['entityType', 'entityId', 'action', 'severity', 'actorId', 'userId', 'from', 'to'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
/** The filters as one comparable value (empty and absent are the same). */
const filterKey = (source: Partial<Record<FilterKey, string | undefined>>): string => JSON.stringify(FILTER_KEYS.map((key) => source[key] || ''));

/**
 * AUD-01..03 audit viewer (Super Administrator only — the API refuses anyone
 * else): every event with its date and time (12-hour clock), who did it, the
 * readable action — never a raw code — and the record, filtered by record,
 * action, severity, person, employee and period (applied once typing
 * pauses). Every row opens the event's details (`/admin/audit/:id`), by
 * click or keyboard. Read-only.
 */
@Component({
  selector: 'app-audit-log-page',
  imports: [SkeletonRowComponent, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, UserSelectComponent, AlertComponent, ButtonDirective, IconComponent, PageHeaderComponent, PaginationComponent, ...TABLE_IMPORTS, ...FORM_IMPORTS],
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
  /** One employee: what they did and what was done to their account (from an employee's "View Audit Logs"). */
  readonly userId = input<string>();
  readonly from = input<string>();
  readonly to = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly query = computed(() => ({
    entityType: this.entityType(),
    entityId: this.entityId(),
    action: this.action(),
    severity: this.severity(),
    actorId: this.actorId(),
    userId: this.userId(),
    from: this.from(),
    to: this.to(),
    page: this.page(), pageSize: this.pageSize(),
  }));
  protected readonly data = rxResource({ params: () => this.query(), stream: ({ params }) => this.api.get<Page<AuditEntry>>('audit', params) });
  protected readonly rows = computed(() => (this.data.hasValue() ? this.data.value().rows : []));
  protected readonly chevron = ChevronRight;
  protected readonly actionText = (entry: AuditEntry) => auditAction(this.i18n, entry);
  protected readonly actor = (entry: AuditEntry) => auditActor(this.i18n, entry);
  protected readonly time = (entry: AuditEntry) => auditTime(this.i18n, entry);
  protected readonly record = (entry: AuditEntry) => auditRecord(this.i18n, entry);
  protected readonly f = signal({ entityType: '', entityId: '', action: '', severity: '', actorId: '', userId: '', from: '', to: '' });

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
        userId: current.userId ?? '',
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
    this.f.set({ entityType: '', entityId: '', action: '', severity: '', actorId: '', userId: '', from: '', to: '' });
    void this.router.navigate([], { queryParams: {} });
  }

  /** Opens the event's details (row click, Enter). */
  protected open(entry: AuditEntry): void {
    void this.router.navigate(['/', this.i18n.locale(), 'admin', 'audit', entry.id]);
  }
}

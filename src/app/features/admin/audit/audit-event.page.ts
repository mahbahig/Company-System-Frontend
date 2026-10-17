import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api-error';
import { ApiService } from '../../../core/api/api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { StatusPageComponent } from '../../errors/status-page.component';
import { auditFieldLabel, auditValue } from './audit-diff';
import type { AuditChange, AuditEntry } from './audit-entry.interface';
import { auditAction, auditActor, auditRecord, auditTime, RECORD_PATHS } from './audit-presenter';

/**
 * `/admin/audit/:id` — one audit event in full (Super Administrator only;
 * the API answers 404 for anything outside the viewer's audit log): the
 * readable action, who did it, the date and time (12-hour clock), severity,
 * source, the record and the employee it is about (linked where the viewer
 * can open them), where from, and what changed — field by field, before → after
 * in words (a secret only as "changed", never its value); the raw snapshots
 * only in the collapsed technical details. Read-only — an audit event is never
 * edited. Critical-event notifications link here.
 */
@Component({
  selector: 'app-audit-event-page',
  imports: [RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, AlertComponent, ButtonDirective, BreadcrumbsComponent, DetailSkeletonComponent, StatusPageComponent, ...CARD_IMPORTS],
  templateUrl: './audit-event.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class AuditEventPage {
  private readonly api = inject(ApiService);
  private readonly navigation = inject(NavigationService);
  protected readonly i18n = inject(I18nService);

  readonly id = input.required<string>();

  protected readonly event = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get<AuditEntry>(`audit/${encodeURIComponent(params)}`) });
  protected readonly notFound = computed(() => {
    const error = this.event.error();
    return ApiError.is(error) && (error.status === 404 || error.status === 400);
  });
  protected readonly crumbs = computed(() => [{ label: this.i18n.t('admin.audit.title'), path: '/admin/audit' }, { label: this.i18n.t('admin.audit.detail.title') }]);
  protected readonly action = (entry: AuditEntry) => auditAction(this.i18n, entry);
  protected readonly actor = (entry: AuditEntry) => auditActor(this.i18n, entry);
  protected readonly time = (entry: AuditEntry) => auditTime(this.i18n, entry);
  protected readonly record = (entry: AuditEntry) => auditRecord(this.i18n, entry);

  /** The record's page, when the viewer can open it. */
  protected recordLink(entry: AuditEntry): string[] | null {
    const area = RECORD_PATHS[entry.entityType];
    if (!area || !entry.entityId) return null;
    return this.navigation.canOpen(`/${area}/${entry.entityId}`) ? ['/', ...area.split('/'), entry.entityId] : null;
  }

  /** What an event without field changes recorded (a creation's snapshot, a sign-in's method), as readable pairs. */
  protected extra(entry: AuditEntry): Array<{ key: string; label: string; value: string }> {
    if (this.changes(entry).length) return [];
    const source = entry.after ?? entry.before ?? {};
    return Object.keys(source).map((key) => ({ key, label: auditFieldLabel(this.i18n, key), value: auditValue(this.i18n, { field: key }, source[key], entry.entityType) }));
  }

  /** The API's change set (derived from the changed fields for a response without one). */
  protected changes(entry: AuditEntry): AuditChange[] {
    return entry.changes ?? entry.changedFields.map((field) => ({ field, before: entry.before?.[field] ?? null, after: entry.after?.[field] ?? null }));
  }

  protected fieldLabel(change: AuditChange): string {
    return auditFieldLabel(this.i18n, change.field);
  }

  protected value(entry: AuditEntry, change: AuditChange, side: 'before' | 'after'): string {
    return auditValue(this.i18n, change, change[side], entry.entityType);
  }

  /** The raw snapshots, for the technical details only. */
  protected raw(entry: AuditEntry): string {
    return JSON.stringify({ before: entry.before ?? null, after: entry.after ?? null }, null, 2);
  }

  protected targetLink(entry: AuditEntry): string[] | null {
    const id = entry.target?.id;
    return id && this.navigation.canOpen(`/employees/${id}`) ? ['/', 'employees', id] : null;
  }
}

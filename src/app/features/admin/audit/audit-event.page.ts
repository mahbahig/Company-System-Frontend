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
import type { AuditEntry } from './audit-entry.interface';
import { auditAction, auditActor, auditRecord, auditTime, RECORD_PATHS } from './audit-presenter';

/**
 * `/admin/audit/:id` — one audit event in full (Super Administrator only;
 * the API answers 404 for anything outside the viewer's audit log): the
 * readable action, who did it, the date and time (12-hour clock), severity,
 * source, the record (linked where the viewer can open it), where from, and
 * every changed field before and after. Read-only — an audit event is never
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
    return this.navigation.canOpen(`/${area}/${entry.entityId}`) ? ['/', this.i18n.locale(), ...area.split('/'), entry.entityId] : null;
  }

  protected show(source: Record<string, unknown> | null | undefined, field: string): string {
    const value = source?.[field];
    if (value === undefined || value === null || value === '') return '∅';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return text.length > 500 ? text.slice(0, 500) + '…' : text;
  }

  /** What an event without field changes recorded (e.g. a sign-in's method), as readable pairs. */
  protected extra(entry: AuditEntry): Array<{ key: string; value: string }> {
    if (entry.changedFields.length) return [];
    const source = entry.after ?? entry.before ?? {};
    return Object.keys(source).map((key) => ({ key, value: this.show(source, key) }));
  }
}

import { Component, computed, inject, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Check, CircleCheckBig } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PagerState } from '../../../shared/crm/pagination/local-pager';
import { PageSizeSelectComponent } from '../../../shared/crm/pagination/page-size-select.component';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { SecurityAlertActions } from './security-alert-actions.service';
import { SecurityApi, type SecurityAlert } from './security-api.service';
import { ALERT_STATUS_TONE, SEVERITY_TONE } from './security-display';

/** The alert views: open ones (the default), each status, or all. */
const VIEWS: Record<string, string | undefined> = { open: 'new,acknowledged', new: 'new', acknowledged: 'acknowledged', resolved: 'resolved', all: undefined };

/**
 * The Security Alert Center: alerts grouped from security events, most
 * severe and latest first, filtered by status and severity, paged by the API.
 * Each row opens the alert; Acknowledge and Resolve ask a contextual
 * confirmation and run inside it (Super Administrators only — the API checks).
 */
@Component({
  selector: 'app-security-alerts',
  imports: [TranslatePipe, RouterLink, AlertComponent, BadgeComponent, ButtonDirective, IconComponent, SkeletonRowComponent, PaginationComponent, PageSizeSelectComponent, ...TABLE_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './security-alerts.component.html',
})
export class SecurityAlertsComponent {
  private readonly api = inject(SecurityApi);
  private readonly actions = inject(SecurityAlertActions);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly icons = { acknowledge: Check, resolve: CircleCheckBig };
  protected readonly severityTone = SEVERITY_TONE;
  protected readonly statusTone = ALERT_STATUS_TONE;
  protected readonly views = Object.keys(VIEWS);
  protected readonly severities = ['critical', 'high', 'medium', 'low'] as const;

  /** An alert changed (acknowledged / resolved): the page refreshes its counts. */
  readonly changed = output<void>();

  protected readonly view = signal('open');
  protected readonly severity = signal('');
  protected readonly pager = new PagerState();
  protected readonly alerts = rxResource({
    params: () => ({ status: VIEWS[this.view()], severity: this.severity() || undefined, page: this.pager.page(), pageSize: this.pager.pageSize() }),
    stream: ({ params }) => this.api.alerts(params),
  });
  protected readonly rows = computed(() => (this.alerts.hasValue() ? this.alerts.value().rows : []));

  protected setView(view: string): void {
    this.view.set(view);
    this.pager.reset();
  }

  protected setSeverity(severity: string): void {
    this.severity.set(severity);
    this.pager.reset();
  }

  protected open(alert: SecurityAlert): void {
    void this.router.navigate(['/', 'admin', 'security', 'alerts', alert.id]);
  }

  protected async acknowledge(alert: SecurityAlert, event: Event): Promise<void> {
    event.stopPropagation();
    if (await this.actions.acknowledge(alert)) this.refresh();
  }

  protected async resolve(alert: SecurityAlert, event: Event): Promise<void> {
    event.stopPropagation();
    if (await this.actions.resolve(alert)) this.refresh();
  }

  reload(): void {
    this.alerts.reload();
  }

  private refresh(): void {
    this.alerts.reload();
    this.changed.emit();
  }
}

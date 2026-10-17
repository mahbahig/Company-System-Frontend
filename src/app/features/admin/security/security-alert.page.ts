import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Check, CircleCheckBig } from 'lucide';

import { ApiError } from '../../../core/api/api-error';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { StatusPageComponent } from '../../errors/status-page.component';
import { SecurityAlertActions } from './security-alert-actions.service';
import { SecurityApi } from './security-api.service';
import { ALERT_STATUS_TONE, SEVERITY_TONE } from './security-display';

/**
 * One security alert: what was detected, how serious, about whom and from
 * where, when it was first and last seen, how many findings it groups (each
 * with its device, session and audit event), and its lifecycle — with
 * Acknowledge and Resolve (contextual confirmations; the API decides).
 */
@Component({
  selector: 'app-security-alert-page',
  imports: [TranslatePipe, RouterLink, BreadcrumbsComponent, AlertComponent, BadgeComponent, ButtonDirective, IconComponent, DetailSkeletonComponent, StatusPageComponent, ...CARD_IMPORTS],
  templateUrl: './security-alert.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class SecurityAlertPage {
  private readonly api = inject(SecurityApi);
  private readonly actions = inject(SecurityAlertActions);
  protected readonly i18n = inject(I18nService);
  protected readonly icons = { acknowledge: Check, resolve: CircleCheckBig };
  protected readonly severityTone = SEVERITY_TONE;
  protected readonly statusTone = ALERT_STATUS_TONE;

  readonly id = input.required<string>();
  protected readonly alert = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.alert(params) });
  protected readonly notFound = computed(() => ApiError.is(this.alert.error()) && (this.alert.error() as ApiError).status === 404);
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('securityCenter.title'), link: ['/', 'admin', 'security'] },
    { label: this.alert.hasValue() ? this.i18n.pick(this.alert.value().title.ar, this.alert.value().title.en) : this.i18n.t('securityCenter.alerts.alert') },
  ]);

  protected device(event: { device: { os: string | null; browser: string | null; deviceType: string | null } | null }): string {
    const device = event.device;
    if (!device) return '—';
    return [device.browser, device.os].filter(Boolean).join(' · ') || '—';
  }

  protected async acknowledge(): Promise<void> {
    if (this.alert.hasValue() && (await this.actions.acknowledge(this.alert.value()))) this.alert.reload();
  }

  protected async resolve(): Promise<void> {
    if (this.alert.hasValue() && (await this.actions.resolve(this.alert.value()))) this.alert.reload();
  }
}

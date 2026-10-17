import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RefreshCw } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import type { ComponentHealth, SystemHealthReport } from './security-api.service';
import { COMPONENT_TONE, OVERALL_TONE } from './security-display';

/** The facts worth a line on a component's card (the dialog shows them all). */
const HEADLINE: Record<ComponentHealth['key'], string[]> = {
  api: ['uptimeSeconds'],
  database: [],
  redis: [],
  queues: ['failed', 'waiting'],
  storage: ['uploadsAvailable'],
  email: ['failed24h', 'sent24h'],
};

/**
 * System Health: the overall status (healthy / degraded / critical, from
 * the component checks) and one card per real component — API, database,
 * Redis, queues, storage, e-mail — with its state, latency and key facts.
 * "Details" shows everything measured and when it was checked (12-hour clock).
 * The page refreshes it periodically; "Refresh" asks for a fresh check.
 */
@Component({
  selector: 'app-system-health',
  imports: [TranslatePipe, AlertComponent, BadgeComponent, ButtonDirective, DialogComponent, IconComponent],
  templateUrl: './system-health.component.html',
})
export class SystemHealthComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly refreshIcon = RefreshCw;

  readonly report = input<SystemHealthReport | null>(null);
  readonly loading = input(false);
  readonly error = input<unknown>(null);
  readonly refresh = output<void>();

  protected readonly componentTone = COMPONENT_TONE;
  protected readonly overallTone = OVERALL_TONE;
  protected readonly selected = signal<ComponentHealth | null>(null);
  protected readonly detailsOpen = signal(false);
  protected readonly selectedFacts = computed(() => Object.entries(this.selected()?.details ?? {}));

  protected headline(component: ComponentHealth): Array<[string, string | number | boolean | null]> {
    return HEADLINE[component.key].filter((key) => key in component.details).map((key) => [key, component.details[key]!]);
  }

  /** A fact as people read it: yes / no, numbers, uptime in hours, latency in ms. */
  protected fact(key: string, value: string | number | boolean | null): string {
    if (value === null) return '—';
    if (typeof value === 'boolean') return this.i18n.t(value ? 'securityCenter.health.yes' : 'securityCenter.health.no');
    if (key === 'uptimeSeconds' && typeof value === 'number') return this.i18n.t('securityCenter.health.uptime', { hours: this.i18n.formatNumber(Math.floor(value / 3600)), minutes: this.i18n.formatNumber(Math.floor((value % 3600) / 60)) });
    if (typeof value === 'number') return this.i18n.formatNumber(value);
    return value;
  }

  protected factLabel(key: string): string {
    const k = `securityCenter.health.facts.${key}`;
    return this.i18n.has(k) ? this.i18n.t(k) : key;
  }

  protected reasonText(component: ComponentHealth): string | null {
    if (!component.reason) return null;
    const k = `securityCenter.health.reasons.${component.reason}`;
    return this.i18n.has(k) ? this.i18n.t(k) : component.reason;
  }

  protected showDetails(component: ComponentHealth): void {
    this.selected.set(component);
    this.detailsOpen.set(true);
  }
}

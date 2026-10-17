import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import type { AuditEntry } from '../audit/audit-entry.interface';
import { auditAction, auditActor, auditTime } from '../audit/audit-presenter';
import { SecurityApi } from './security-api.service';

/**
 * Recent security activity — sign-ins (and failed ones), sessions ended,
 * the system lock and maintenance, alerts, account changes — straight from
 * the audit trail: who, what (the readable action), when (12-hour clock),
 * from where. Each line opens the event; the audit log has the rest.
 */
@Component({
  selector: 'app-security-activity',
  imports: [TranslatePipe, RouterLink, StatusBadgeComponent, AlertComponent, ButtonDirective, ...CARD_IMPORTS],
  template: `
    <section appCard aria-labelledby="sc-activity" data-testid="security-activity">
      <div appCardHeader class="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <h2 appCardTitle id="sc-activity">{{ 'securityCenter.activity.title' | t }}</h2>
          <p appCardDescription>{{ 'securityCenter.activity.subtitle' | t }}</p>
        </div>
        <a appButton variant="outline" size="sm" [routerLink]="['/', 'admin', 'audit']">{{ 'securityCenter.activity.viewAll' | t }}</a>
      </div>
      <div appCardContent>
        @if (activity.error()) {
          <app-alert variant="destructive">{{ i18n.errorText(activity.error()) }}</app-alert>
        } @else if (activity.hasValue()) {
          @if (activity.value().length) {
            <ul class="flex flex-col divide-y divide-border">
              @for (entry of activity.value(); track entry.id) {
                <li>
                  <a [routerLink]="['/', 'admin', 'audit', entry.id]" class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md px-1 py-2.5 text-sm transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="security-activity-row">
                    <span class="min-w-0">
                      <span class="font-medium">{{ actor(entry) }}</span>
                      <span class="text-muted-foreground"> · {{ action(entry) }}</span>
                    </span>
                    <span class="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      @if (entry.severity !== 'info') {
                        <app-status-badge enum="auditSeverity" [value]="entry.severity" />
                      }
                      @if (entry.ip) {
                        <span dir="ltr" class="font-mono">{{ entry.ip }}</span>
                      }
                      <time class="tabular" [attr.datetime]="entry.occurredAt">{{ time(entry) }}</time>
                    </span>
                  </a>
                </li>
              }
            </ul>
          } @else {
            <p class="text-sm text-muted-foreground">{{ 'securityCenter.activity.empty' | t }}</p>
          }
        } @else {
          <p class="text-sm text-muted-foreground" role="status">{{ 'common.labels.loading' | t }}</p>
        }
      </div>
    </section>
  `,
})
export class SecurityActivityComponent {
  private readonly api = inject(SecurityApi);
  protected readonly i18n = inject(I18nService);
  protected readonly activity = rxResource({ stream: () => this.api.activity(12) });
  protected readonly action = (entry: AuditEntry) => auditAction(this.i18n, entry);
  protected readonly actor = (entry: AuditEntry) => auditActor(this.i18n, entry);
  protected readonly time = (entry: AuditEntry) => auditTime(this.i18n, entry);

  reload(): void {
    this.activity.reload();
  }
}

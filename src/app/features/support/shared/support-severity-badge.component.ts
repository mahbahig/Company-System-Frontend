import { Component, computed, input } from '@angular/core';
import { TriangleAlert } from 'lucide';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import type { SupportTicketSeverity } from '../models/support-ticket.interface';
import { CRUCIAL_SUPPORT_SEVERITY, SUPPORT_SEVERITY_TONE } from './support-display';

/**
 * A ticket's severity, the same everywhere: a toned badge, and for a critical
 * (crucial) ticket a warning icon and bold text so it stands out in any list.
 */
@Component({
  selector: 'app-support-severity-badge',
  imports: [TranslatePipe, BadgeComponent, IconComponent],
  template: `
    <app-badge [tone]="tone()" [class.font-semibold]="crucial()">
      @if (crucial()) {
        <app-icon [icon]="alertIcon" svgClass="size-3.5 me-1" />
      }
      {{ 'support.severity.' + severity() | t }}
    </app-badge>
  `,
})
export class SupportSeverityBadgeComponent {
  readonly severity = input.required<SupportTicketSeverity>();

  protected readonly alertIcon = TriangleAlert;
  protected readonly tone = computed(() => SUPPORT_SEVERITY_TONE[this.severity()] ?? 'neutral');
  protected readonly crucial = computed(() => this.severity() === CRUCIAL_SUPPORT_SEVERITY);
}

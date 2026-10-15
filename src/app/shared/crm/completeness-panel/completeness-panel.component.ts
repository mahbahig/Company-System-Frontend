import { Component, computed, inject, input, output, signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { BadgeComponent } from '../../ui/badge/badge.component';
import { ButtonDirective } from '../../ui/button/button.directive';
import { CardContentDirective } from '../../ui/card/card-content.directive';
import { CardHeaderDirective } from '../../ui/card/card-header.directive';
import { CardTitleDirective } from '../../ui/card/card-title.directive';
import { CardDirective } from '../../ui/card/card.directive';
import { InfoRequestDialogComponent } from '../info-request/info-request-dialog.component';
import type { CompletenessItem } from './completeness-item.interface';
import type { CompletenessResult } from './completeness-result.interface';

/**
 * Score bar + missing items (CPL-02..05). Gate items (needed for the next
 * stage) come before recommended ones. CPL-03: each item names who completes
 * it and, when the record is given, offers "Request…" which creates a tracked
 * information request for a colleague or the customer.
 */
@Component({
  selector: 'app-completeness-panel',
  imports: [TranslatePipe, BadgeComponent, ButtonDirective, CardDirective, CardHeaderDirective, CardTitleDirective, CardContentDirective, InfoRequestDialogComponent],
  templateUrl: './completeness-panel.component.html',
})
export class CompletenessPanelComponent {
  private static nextId = 0;
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly result = input.required<CompletenessResult>();
  readonly heading = input<string>();
  /** The record the items belong to — enables "Request…" (CPL-03). */
  readonly entityType = input<string>();
  readonly entityId = input<string>();
  /** The customer's contact for customer-directed requests (PDC-03). */
  readonly contactId = input<string | null>(null);
  readonly requested = output<void>();

  protected readonly headingId = `completeness-heading-${CompletenessPanelComponent.nextId++}`;
  protected readonly dialogOpen = signal(false);
  protected readonly requestItems = signal<Array<{ id: string; label: string }>>([]);
  protected readonly requestRoles = signal<string | undefined>(undefined);

  protected readonly canRequest = computed(() => !!this.entityType() && !!this.entityId() && this.auth.can('tasks.create'));
  protected readonly ordered = computed(() => [...this.result().missing].sort((a, b) => Number(a.level === 'recommended') - Number(b.level === 'recommended')));
  protected readonly barTone = computed(() => {
    const score = this.result().score;
    return score >= 80 ? 'bg-success' : score >= 50 ? 'bg-warning' : 'bg-destructive';
  });

  protected label(item: CompletenessItem): string {
    const key = `completeness.items.${item.id}`;
    if (this.i18n.has(key)) return this.i18n.t(key);
    const field = item.id.split('.').pop() ?? item.id;
    return field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  }

  protected section(item: CompletenessItem): string {
    const key = `completeness.sections.${item.section}`;
    if (this.i18n.has(key)) return this.i18n.t(key);
    const intake = `intake.sections.${item.section}`;
    return this.i18n.has(intake) ? this.i18n.t(intake) : item.section;
  }

  protected role(code: string): string {
    return this.i18n.has(`enums.roleCode.${code}`) ? this.i18n.t(`enums.roleCode.${code}`) : code;
  }

  protected request(items: CompletenessItem[]): void {
    this.requestItems.set(items.map((item) => ({ id: item.id, label: this.label(item) })));
    const roles = [...new Set(items.map((item) => item.responsibleRole).filter((role): role is string => !!role))];
    this.requestRoles.set(roles.length ? roles.join(',') : undefined);
    this.dialogOpen.set(true);
  }
}

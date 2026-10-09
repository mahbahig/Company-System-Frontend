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
  template: `
    <section appCard [attr.aria-labelledby]="headingId">
      <div appCardHeader class="flex flex-row items-center justify-between gap-2">
        <h2 appCardTitle [id]="headingId">{{ heading() || ('completeness.title' | t) }}</h2>
        @if (canRequest() && ordered().length > 1) {
          <button type="button" appButton variant="outline" size="sm" (click)="request(ordered())">{{ 'completeness.requestFrom' | t }}</button>
        }
      </div>
      <div appCardContent class="flex flex-col gap-4">
        <div>
          <div class="mb-1.5 flex items-center justify-between text-sm">
            <span class="font-medium">{{ 'completeness.score' | t: { score: result().score } }}</span>
            <span class="tabular text-muted-foreground" dir="ltr">{{ result().satisfiedCount }}/{{ result().total }}</span>
          </div>
          <div
            role="progressbar"
            [attr.aria-label]="'completeness.progressLabel' | t"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-valuenow]="result().score"
            class="h-2 overflow-hidden rounded-full bg-secondary"
          >
            <div class="h-full rounded-full transition-all" [class]="barTone()" [style.width.%]="result().score"></div>
          </div>
        </div>

        @if (ordered().length === 0) {
          <p class="text-sm text-muted-foreground">{{ 'completeness.allComplete' | t }}</p>
        } @else {
          <div>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ 'completeness.missing' | t }}</h3>
            <ul class="flex flex-col gap-2">
              @for (item of ordered(); track item.id) {
                <li class="flex items-start justify-between gap-3 text-sm">
                  <span>
                    {{ label(item) }}
                    <span class="block text-xs text-muted-foreground">
                      {{ section(item) }}
                      @if (item.responsibleRole) {
                        · {{ 'completeness.responsible' | t: { role: role(item.responsibleRole) } }}
                      }
                    </span>
                  </span>
                  <span class="flex shrink-0 items-center gap-2">
                    <app-badge [tone]="item.level === 'recommended' ? 'neutral' : 'warning'">{{ 'completeness.levels.' + item.level | t }}</app-badge>
                    @if (canRequest()) {
                      <button type="button" class="text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="request([item])">{{ 'completeness.requestFrom' | t }}</button>
                    }
                  </span>
                </li>
              }
            </ul>
          </div>
        }
      </div>
    </section>

    @if (entityType() && entityId()) {
      <app-info-request-dialog
        [(open)]="dialogOpen"
        [entityType]="entityType()!"
        [entityId]="entityId()!"
        [items]="requestItems()"
        [roles]="requestRoles()"
        [contactId]="contactId()"
        (created)="requested.emit()"
      />
    }
  `,
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

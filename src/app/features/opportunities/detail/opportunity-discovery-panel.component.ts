import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { pipelineErrorText } from '../../../shared/crm/pipeline-tracker/pipeline-error';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CardContentDirective } from '../../../shared/ui/card/card-content.directive';
import { CardHeaderDirective } from '../../../shared/ui/card/card-header.directive';
import { CardTitleDirective } from '../../../shared/ui/card/card-title.directive';
import { CardDirective } from '../../../shared/ui/card/card.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { SelectDirective } from '../../../shared/ui/form/select.directive';
import type { FieldFact } from '../models/field-fact.interface';
import type { Opportunity } from '../models/opportunity.interface';
import { OpportunitiesApi } from '../opportunities-api.service';

/** O1 discovery facts the technical request needs (each must be known or explicitly declared). */
const FACTS = [
  'site_location',
  'success_criteria',
  'operating_hours',
  'existing_assets',
  'site_constraints',
  'access_requirements',
  'procurement_process',
  'budget',
  'load_basis',
  'assumptions',
  'unresolved_questions',
] as const;
const STATES: FieldFact['state'][] = ['known', 'unknown', 'not_applicable', 'awaiting_customer'];

/**
 * Discovery facts with their explicit state (known / unknown / not applicable
 * / awaiting customer — unknown is never complete) and the risk register.
 */
@Component({
  selector: 'app-opportunity-discovery-panel',
  imports: [TranslatePipe, AlertComponent, BadgeComponent, ButtonDirective, CardDirective, CardHeaderDirective, CardTitleDirective, CardContentDirective, InputDirective, SelectComponent, SelectDirective],
  template: `
    <section appCard aria-labelledby="discovery-heading">
      <div appCardHeader>
        <h2 appCardTitle id="discovery-heading">{{ 'crm.opportunities.discovery.title' | t }}</h2>
      </div>
      <div appCardContent class="flex flex-col gap-4">
        @if (error(); as text) {
          <app-alert variant="destructive" role="alert">{{ text }}</app-alert>
        }
        <form class="flex flex-col gap-2" (submit)="saveFacts($event)">
          @for (fact of facts; track fact) {
            <div class="grid items-center gap-2 sm:grid-cols-[12rem_10rem_1fr]">
              <span class="text-sm">{{ 'crm.opportunities.discovery.facts.' + fact | t }}</span>
              <app-select>
                <select appSelect [attr.aria-label]="'crm.opportunities.discovery.state' | t" [value]="draft()[fact]?.state ?? ''" [disabled]="!canEdit()" (change)="setState(fact, $any($event.target).value)">
                  <option value="">{{ 'crm.common.notSet' | t }}</option>
                  @for (state of states; track state) {
                    <option [value]="state">{{ 'crm.opportunities.discovery.states.' + state | t }}</option>
                  }
                </select>
              </app-select>
              <input
                appInput
                [attr.aria-label]="'crm.opportunities.discovery.facts.' + fact | t"
                [value]="text(fact)"
                [disabled]="!canEdit() || !draft()[fact]?.state"
                (input)="setText(fact, $any($event.target).value)"
              />
            </div>
          }
          @if (canEdit()) {
            <div><button type="submit" appButton size="sm" [disabled]="busy()">{{ 'common.actions.save' | t }}</button></div>
          }
        </form>

        <div class="border-t border-border pt-4">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ 'crm.opportunities.risks.title' | t }}</h3>
          <ul class="flex flex-col gap-1.5 text-sm">
            @for (risk of opportunity().risks ?? []; track $index) {
              <li class="flex flex-wrap items-center gap-2">
                <app-badge [tone]="risk.severity === 'high' || risk.severity === 'critical' ? 'danger' : 'warning'">{{ risk.severity }}</app-badge>
                <span>{{ risk.description }}</span>
                @if (risk.mitigation) {
                  <span class="text-xs text-muted-foreground">— {{ risk.mitigation }}</span>
                }
              </li>
            } @empty {
              <li class="text-muted-foreground">{{ 'crm.common.none' | t }}</li>
            }
          </ul>
          @if (canEdit()) {
            <form class="mt-3 flex flex-wrap items-end gap-2" (submit)="addRisk($event)">
              <input appInput class="min-w-64 flex-1" [placeholder]="'crm.opportunities.risks.description' | t" [value]="riskText()" (input)="riskText.set($any($event.target).value)" />
              <app-select>
                <select appSelect [attr.aria-label]="'crm.opportunities.risks.severity' | t" [value]="riskSeverity()" (change)="riskSeverity.set($any($event.target).value)">
                  @for (severity of ['low', 'medium', 'high', 'critical']; track severity) {
                    <option [value]="severity">{{ severity }}</option>
                  }
                </select>
              </app-select>
              <button type="submit" appButton size="sm" variant="outline" [disabled]="busy() || !riskText().trim()">{{ 'crm.opportunities.risks.add' | t }}</button>
            </form>
          }
        </div>
      </div>
    </section>
  `,
})
export class OpportunityDiscoveryPanelComponent {
  private readonly api = inject(OpportunitiesApi);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly opportunity = input.required<Opportunity>();
  readonly changed = output<void>();

  protected readonly facts = FACTS;
  protected readonly states = STATES;
  protected readonly draft = signal<Record<string, FieldFact>>({});
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly riskText = signal('');
  protected readonly riskSeverity = signal('medium');
  protected readonly canEdit = computed(() => this.auth.can('opportunities.edit') && this.opportunity().outcome === 'open');

  constructor() {
    effect(() => this.draft.set({ ...(this.opportunity().discovery ?? {}) }));
  }

  protected text(fact: string): string {
    const entry = this.draft()[fact];
    if (!entry) return '';
    return entry.state === 'known' ? String(entry.value ?? '') : (entry.note ?? '');
  }

  protected setState(fact: string, state: string): void {
    const next = { ...this.draft() };
    if (!state) delete next[fact];
    else next[fact] = { ...(next[fact] ?? {}), state: state as FieldFact['state'] };
    this.draft.set(next);
  }

  protected setText(fact: string, value: string): void {
    const entry = this.draft()[fact];
    if (!entry) return;
    this.draft.set({ ...this.draft(), [fact]: entry.state === 'known' ? { ...entry, value } : { ...entry, note: value } });
  }

  protected async saveFacts(event: Event): Promise<void> {
    event.preventDefault();
    await this.run(() => this.api.discovery(this.opportunity().id, this.draft()));
  }

  protected async addRisk(event: Event): Promise<void> {
    event.preventDefault();
    await this.run(() => this.api.addRisk(this.opportunity().id, { description: this.riskText().trim(), severity: this.riskSeverity() }));
    this.riskText.set('');
  }

  private async run(call: () => ReturnType<OpportunitiesApi['addRisk']>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(call());
      this.changed.emit();
    } catch (error: unknown) {
      this.error.set(pipelineErrorText(this.i18n, error));
    } finally {
      this.busy.set(false);
    }
  }
}

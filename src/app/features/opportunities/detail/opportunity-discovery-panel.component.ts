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
  templateUrl: './opportunity-discovery-panel.component.html',
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

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { pipelineErrorText } from '../../../shared/crm/pipeline-tracker/pipeline-error';
import { PipelineTrackerComponent, type PipelineActionRequest } from '../../../shared/crm/pipeline-tracker/pipeline-tracker.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { SelectDirective } from '../../../shared/ui/form/select.directive';
import { TextareaDirective } from '../../../shared/ui/form/textarea.directive';
import type { Opportunity } from '../models/opportunity.interface';
import { OpportunitiesApi } from '../opportunities-api.service';

/** O-stages entered only by their business action elsewhere, and where. */
const OPPORTUNITY_VIA: Record<string, string> = {
  accept_technical_request: 'pipeline.viaHandoff',
  accept_survey: 'pipeline.viaSurvey',
  return_survey: 'pipeline.viaSurvey',
  approve_feasibility: 'pipeline.viaTechnical',
  reject_feasibility: 'pipeline.viaTechnical',
  approve_costing: 'pipeline.viaCosting',
  send_quotation: 'pipeline.viaQuote',
  send_revised_quotation: 'pipeline.viaQuote',
  request_revision: 'pipeline.viaProposals',
  record_customer_acceptance: 'pipeline.viaAcceptance',
  contract_fully_signed: 'pipeline.viaContract',
  put_on_hold: 'pipeline.viaProposals',
  move_to_nurture: 'pipeline.viaProposals',
};
const DEAL_ACTIONS = [
  'submit_costing',
  'return_for_correction',
  'return_revision',
  'issue_quotation',
  'enter_negotiation',
  'submit_revision',
  'issue_revised_quotation',
  'customer_accepted',
  'send_for_signature',
  'revise_contract',
  'record_signatures',
  'close_lost',
];

/**
 * The opportunity (O0–O8) and commercial deal (D0–D7) trackers with the only
 * manual moves the pipeline allows: confirming the need, closing as lost with
 * a structured reason, reopening with a reason. Every other stage shows where
 * its business action happens. Finance places / releases the deal's hold here.
 */
@Component({
  selector: 'app-opportunity-workflow-panel',
  imports: [TranslatePipe, PipelineTrackerComponent, AlertComponent, ButtonDirective, InputDirective, LabelComponent, SelectComponent, SelectDirective, TextareaDirective],
  templateUrl: './opportunity-workflow-panel.component.html',
  host: { class: 'flex flex-col gap-4' },
})
export class OpportunityWorkflowPanelComponent {
  private readonly api = inject(OpportunitiesApi);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  readonly opportunity = input.required<Opportunity>();
  readonly changed = output<void>();

  protected readonly opportunityVia = OPPORTUNITY_VIA;
  protected readonly hiddenOpportunityActions = Object.keys(OPPORTUNITY_VIA);
  protected readonly dealActions = DEAL_ACTIONS;
  protected readonly dealVia = Object.fromEntries(DEAL_ACTIONS.map((action) => [action, 'pipeline.viaProposals']));
  protected readonly needMethods = ['meeting', 'call', 'site_visit', 'written', 'other'] as const;

  protected readonly workflow = rxResource({
    params: () => ({ id: this.opportunity().id, at: this.opportunity().updatedAt }),
    stream: ({ params }) => this.api.workflow(params.id),
  });
  protected readonly canFinance = computed(() => this.auth.can('financials.edit'));

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = signal<'confirm_need' | 'close_lost' | null>(null);
  protected readonly needMethod = signal<(typeof this.needMethods)[number]>('meeting');
  protected readonly needNote = signal('');
  protected readonly lostCode = signal('');
  protected readonly lostCompetitor = signal('');
  protected readonly lostFeedback = signal('');
  protected readonly lostReopenAt = signal('');
  protected readonly holdReason = signal('');
  protected readonly holdNote = signal('');

  constructor() {
    void this.reference.load();
  }

  protected onAction(request: PipelineActionRequest): void {
    this.error.set(null);
    if (request.action === 'confirm_need' || request.action === 'close_lost') {
      this.form.set(request.action);
      return;
    }
    if (request.action === 'reopen_opportunity')
      void this.run(() => this.api.changeStage(this.opportunity().id, { toStage: 'discovery', reason: request.reason }));
  }

  protected confirmNeed(event: Event): void {
    event.preventDefault();
    void this.run(() =>
      this.api.changeStage(this.opportunity().id, { toStage: 'discovery', needConfirmation: { method: this.needMethod(), note: this.needNote().trim() } }),
    );
  }

  protected closeLost(event: Event): void {
    event.preventDefault();
    void this.run(() =>
      this.api.changeStage(this.opportunity().id, {
        toStage: 'lost',
        lostReason: {
          code: this.lostCode(),
          competitorCode: this.lostCompetitor() || undefined,
          finalFeedback: this.lostFeedback().trim() || undefined,
          reopenAt: this.lostReopenAt() || undefined,
        },
      }),
    );
  }

  protected toggleHold(event: Event): void {
    event.preventDefault();
    const active = !this.opportunity().deal?.financeHold?.active;
    void this.run(() =>
      this.api.financeHold(this.opportunity().id, { active, reasonCode: active ? this.holdReason().trim() : undefined, note: this.holdNote().trim() || undefined }),
    );
  }

  private async run(call: () => ReturnType<OpportunitiesApi['changeStage']>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(call());
      this.form.set(null);
      this.needNote.set('');
      this.holdNote.set('');
      this.holdReason.set('');
      this.changed.emit();
    } catch (error: unknown) {
      this.error.set(pipelineErrorText(this.i18n, error));
    } finally {
      this.busy.set(false);
    }
  }
}

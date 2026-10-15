import { Component, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { firstValueFrom, type Observable } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { pipelineErrorText } from '../../../shared/crm/pipeline-tracker/pipeline-error';
import { PipelineTrackerComponent, type PipelineActionRequest } from '../../../shared/crm/pipeline-tracker/pipeline-tracker.component';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { SelectDirective } from '../../../shared/ui/form/select.directive';
import { TextareaDirective } from '../../../shared/ui/form/textarea.directive';
import { LeadsApi } from '../leads-api.service';
import type { Lead } from '../models/lead.interface';
import type { QualificationPayload } from '../models/qualification-payload.interface';

type LeadForm = 'identity' | 'qualify' | 'handoff' | 'accept' | 'reassign' | null;

/** Lead moves performed elsewhere on the page. */
const LEAD_VIA: Record<string, string> = {
  log_two_way_contact: 'pipeline.viaAttempts',
  schedule_retry: 'pipeline.viaAttempts',
  close_lead: 'crm.leads.workflow.viaLifecycle',
  nurture_lead: 'crm.leads.workflow.viaLifecycle',
  reopen_lead: 'crm.leads.workflow.viaLifecycle',
};

/**
 * L0–L5 tracker with the lead's business actions: start the identity review,
 * record the identity decision (unique / linked / merged — never automatic),
 * record the qualification outcome, hand off to a named Sales Representative,
 * accept / return / reassign the handoff, convert.
 */
@Component({
  selector: 'app-lead-workflow-panel',
  imports: [TranslatePipe, PipelineTrackerComponent, ButtonDirective, InputDirective, LabelComponent, SelectComponent, SelectDirective, TextareaDirective, UserSelectComponent],
  templateUrl: './lead-workflow-panel.component.html',
  host: { class: 'flex flex-col gap-4' },
})
export class LeadWorkflowPanelComponent {
  private readonly api = inject(LeadsApi);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly lead = input.required<Lead>();
  readonly changed = output<void>();

  protected readonly via = LEAD_VIA;
  protected readonly hiddenActions = Object.keys(LEAD_VIA);
  protected readonly workflow = rxResource({
    params: () => ({ id: this.lead().id, at: this.lead().updatedAt }),
    stream: ({ params }) => this.api.workflow(params.id),
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = signal<LeadForm>(null);
  protected readonly identityDecision = signal<'unique' | 'linked' | 'merged'>('unique');
  protected readonly identityTarget = signal('');
  protected readonly identityNote = signal('');
  protected readonly qualification = signal<QualificationPayload>({ outcome: 'qualified', conversationSummary: '' });
  protected readonly handoffTo = signal('');
  protected readonly handoffNeed = signal('');
  protected readonly handoffNext = signal('');
  protected readonly handoffAppointment = signal('');
  protected readonly firstAction = signal('');
  protected readonly firstActionAt = signal('');
  protected readonly reassignReason = signal('');

  protected reference(code: string): string {
    const key = `crm.leads.workflow.closure.${code}`;
    return this.i18n.has(key) ? this.i18n.t(key) : code;
  }

  protected onAction(request: PipelineActionRequest): void {
    this.error.set(null);
    switch (request.action) {
      case 'start_identity_review':
        void this.run(() => this.api.transition(this.lead().id, 'start_identity_review'));
        return;
      case 'record_identity_decision':
        this.form.set('identity');
        return;
      case 'submit_sales_handoff':
        this.form.set('handoff');
        return;
      case 'accept_sales_handoff':
        this.form.set('accept');
        return;
      case 'reassign_sales_handoff':
        this.form.set('reassign');
        return;
      case 'return_sales_handoff':
        void this.run(() => this.api.returnHandoff(this.lead().id, request.reason ?? ''));
        return;
      case 'convert_to_customer':
        void this.router.navigate([this.i18n.locale(), 'leads', this.lead().id, 'convert']);
        return;
    }
  }

  protected patchQualification(patch: Partial<QualificationPayload>): void {
    this.qualification.set({ ...this.qualification(), ...patch });
  }

  protected submitIdentity(event: Event): void {
    event.preventDefault();
    const decision = this.identityDecision();
    void this.run(() =>
      this.api.identityReview(this.lead().id, {
        decision,
        note: this.identityNote().trim() || undefined,
        ...(decision === 'linked' ? { linkCustomerId: this.identityTarget().trim() } : {}),
        ...(decision === 'merged' ? { mergedIntoLeadId: this.identityTarget().trim() } : {}),
      }),
    );
  }

  protected submitQualification(event: Event): void {
    event.preventDefault();
    const value = this.qualification();
    const iso = (date?: string) => (date ? new Date(date).toISOString() : undefined);
    void this.run(() =>
      this.api.qualify(this.lead().id, {
        outcome: value.outcome,
        conversationSummary: value.conversationSummary.trim(),
        nextAction: value.nextAction?.trim() || undefined,
        nextFollowUpAt: iso(value.nextFollowUpAt),
        revisitAt: iso(value.revisitAt),
        disqualifyReason: value.disqualifyReason || undefined,
        comment: value.comment?.trim() || undefined,
      }),
    );
  }

  protected submitHandoff(event: Event): void {
    event.preventDefault();
    void this.run(() =>
      this.api.submitHandoff(this.lead().id, {
        toUserId: this.handoffTo() || undefined,
        needSummary: this.handoffNeed().trim(),
        recommendedNextAction: this.handoffNext().trim(),
        appointmentAt: this.handoffAppointment() ? new Date(this.handoffAppointment()).toISOString() : undefined,
      }),
    );
  }

  protected submitAccept(event: Event): void {
    event.preventDefault();
    void this.run(() => this.api.acceptHandoff(this.lead().id, { firstAction: this.firstAction().trim(), firstActionAt: new Date(this.firstActionAt()).toISOString() }));
  }

  protected submitReassign(event: Event): void {
    event.preventDefault();
    void this.run(() => this.api.reassignHandoff(this.lead().id, { toUserId: this.handoffTo(), reason: this.reassignReason().trim() }));
  }

  private async run(call: () => Observable<unknown>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(call());
      this.form.set(null);
      this.changed.emit();
    } catch (error: unknown) {
      this.error.set(pipelineErrorText(this.i18n, error));
    } finally {
      this.busy.set(false);
    }
  }
}

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
  template: `
    @if (workflow.hasValue()) {
      <app-pipeline-tracker
        [view]="workflow.value()"
        [via]="via"
        [hidden]="hiddenActions"
        [formActions]="['record_identity_decision', 'submit_sales_handoff', 'accept_sales_handoff', 'reassign_sales_handoff', 'convert_to_customer']"
        [busy]="busy()"
        [error]="error()"
        (act)="onAction($event)"
      />
    }

    @if (lead().status === 'qualifying' && form() !== 'qualify') {
      <div><button type="button" appButton size="sm" variant="outline" (click)="form.set('qualify')">{{ 'crm.leads.workflow.recordQualification' | t }}</button></div>
    }

    @switch (form()) {
      @case ('identity') {
        <form class="flex flex-col gap-3 rounded-md border border-border p-4" (submit)="submitIdentity($event)">
          <h3 class="text-sm font-semibold">{{ 'pipeline.actions.record_identity_decision' | t }}</h3>
          <div class="max-w-xs">
            <label appLabel for="identity-decision" required>{{ 'crm.leads.workflow.decision' | t }}</label>
            <app-select class="mt-1.5">
              <select appSelect id="identity-decision" [value]="identityDecision()" (change)="identityDecision.set($any($event.target).value)">
                @for (decision of ['unique', 'linked', 'merged']; track decision) {
                  <option [value]="decision">{{ 'crm.leads.workflow.decisions.' + decision | t }}</option>
                }
              </select>
            </app-select>
          </div>
          @if (identityDecision() !== 'unique') {
            <div>
              <label appLabel for="identity-target" required>{{ (identityDecision() === 'linked' ? 'crm.leads.workflow.linkCustomerId' : 'crm.leads.workflow.mergedIntoLeadId') | t }}</label>
              <input appInput id="identity-target" dir="ltr" class="mt-1.5" [value]="identityTarget()" (input)="identityTarget.set($any($event.target).value)" />
            </div>
          }
          <div>
            <label appLabel for="identity-note" [required]="identityDecision() !== 'unique'">{{ 'pipeline.reason' | t }}</label>
            <textarea appTextarea id="identity-note" rows="2" class="mt-1.5" [value]="identityNote()" (input)="identityNote.set($any($event.target).value)"></textarea>
          </div>
          <div class="flex gap-2">
            <button type="submit" appButton size="sm" [disabled]="busy() || (identityDecision() !== 'unique' && (!identityTarget().trim() || !identityNote().trim()))">{{ 'pipeline.confirm' | t }}</button>
            <button type="button" appButton size="sm" variant="outline" (click)="form.set(null)">{{ 'common.actions.cancel' | t }}</button>
          </div>
        </form>
      }
      @case ('qualify') {
        <form class="flex flex-col gap-3 rounded-md border border-border p-4" (submit)="submitQualification($event)">
          <h3 class="text-sm font-semibold">{{ 'crm.leads.workflow.recordQualification' | t }}</h3>
          <div class="max-w-xs">
            <label appLabel for="qualification-outcome" required>{{ 'crm.leads.workflow.outcome' | t }}</label>
            <app-select class="mt-1.5">
              <select appSelect id="qualification-outcome" [value]="qualification().outcome" (change)="patchQualification({ outcome: $any($event.target).value })">
                @for (outcome of ['qualified', 'nurture', 'disqualified', 'escalated']; track outcome) {
                  <option [value]="outcome">{{ 'crm.leads.workflow.outcomes.' + outcome | t }}</option>
                }
              </select>
            </app-select>
          </div>
          <div>
            <label appLabel for="qualification-summary" required>{{ 'crm.leads.workflow.conversationSummary' | t }}</label>
            <textarea appTextarea id="qualification-summary" rows="3" class="mt-1.5" [value]="qualification().conversationSummary" (input)="patchQualification({ conversationSummary: $any($event.target).value })"></textarea>
          </div>
          @if (qualification().outcome === 'qualified') {
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label appLabel for="qualification-next" required>{{ 'pipeline.control.nextAction' | t }}</label>
                <input appInput id="qualification-next" class="mt-1.5" [value]="qualification().nextAction ?? ''" (input)="patchQualification({ nextAction: $any($event.target).value })" />
              </div>
              <div>
                <label appLabel for="qualification-due" required>{{ 'pipeline.control.dueAt' | t }}</label>
                <input appInput id="qualification-due" type="date" class="mt-1.5" [value]="qualification().nextFollowUpAt ?? ''" (input)="patchQualification({ nextFollowUpAt: $any($event.target).value })" />
              </div>
            </div>
          }
          @if (qualification().outcome === 'nurture') {
            <div class="max-w-xs">
              <label appLabel for="qualification-revisit" required>{{ 'crm.leads.workflow.revisitAt' | t }}</label>
              <input appInput id="qualification-revisit" type="date" class="mt-1.5" [value]="qualification().revisitAt ?? ''" (input)="patchQualification({ revisitAt: $any($event.target).value })" />
            </div>
          }
          @if (qualification().outcome === 'disqualified') {
            <div class="max-w-xs">
              <label appLabel for="qualification-reason" required>{{ 'crm.leads.close.reasonCode' | t }}</label>
              <app-select class="mt-1.5">
                <select appSelect id="qualification-reason" [value]="qualification().disqualifyReason ?? ''" (change)="patchQualification({ disqualifyReason: $any($event.target).value })">
                  <option value="">{{ 'crm.common.selectPlaceholder' | t }}</option>
                  @for (reason of ['not_a_fit', 'invalid_spam', 'other']; track reason) {
                    <option [value]="reason">{{ reference(reason) }}</option>
                  }
                </select>
              </app-select>
            </div>
          }
          @if (qualification().outcome === 'escalated' || qualification().disqualifyReason === 'other') {
            <div>
              <label appLabel for="qualification-comment" required>{{ 'pipeline.reason' | t }}</label>
              <textarea appTextarea id="qualification-comment" rows="2" class="mt-1.5" [value]="qualification().comment ?? ''" (input)="patchQualification({ comment: $any($event.target).value })"></textarea>
            </div>
          }
          <div class="flex gap-2">
            <button type="submit" appButton size="sm" [disabled]="busy() || !qualification().conversationSummary.trim()">{{ 'pipeline.confirm' | t }}</button>
            <button type="button" appButton size="sm" variant="outline" (click)="form.set(null)">{{ 'common.actions.cancel' | t }}</button>
          </div>
        </form>
      }
      @case ('handoff') {
        <form class="flex flex-col gap-3 rounded-md border border-border p-4" (submit)="submitHandoff($event)">
          <h3 class="text-sm font-semibold">{{ 'pipeline.actions.submit_sales_handoff' | t }}</h3>
          <div class="max-w-sm">
            <label appLabel for="handoff-to">{{ 'crm.leads.workflow.receiver' | t }}</label>
            <app-user-select class="mt-1.5" inputId="handoff-to" roles="sales_representative" [placeholder]="'crm.leads.workflow.receiverAuto' | t" [value]="handoffTo()" (valueChange)="handoffTo.set($event)" />
          </div>
          <div>
            <label appLabel for="handoff-need" required>{{ 'crm.leads.workflow.needSummary' | t }}</label>
            <textarea appTextarea id="handoff-need" rows="3" class="mt-1.5" [value]="handoffNeed()" (input)="handoffNeed.set($any($event.target).value)"></textarea>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label appLabel for="handoff-next" required>{{ 'crm.leads.workflow.recommendedNextAction' | t }}</label>
              <input appInput id="handoff-next" class="mt-1.5" [value]="handoffNext()" (input)="handoffNext.set($any($event.target).value)" />
            </div>
            <div>
              <label appLabel for="handoff-appointment">{{ 'crm.leads.workflow.appointmentAt' | t }}</label>
              <input appInput id="handoff-appointment" type="datetime-local" class="mt-1.5" [value]="handoffAppointment()" (input)="handoffAppointment.set($any($event.target).value)" />
            </div>
          </div>
          <div class="flex gap-2">
            <button type="submit" appButton size="sm" [disabled]="busy() || !handoffNeed().trim() || !handoffNext().trim()">{{ 'pipeline.confirm' | t }}</button>
            <button type="button" appButton size="sm" variant="outline" (click)="form.set(null)">{{ 'common.actions.cancel' | t }}</button>
          </div>
        </form>
      }
      @case ('accept') {
        <form class="flex flex-col gap-3 rounded-md border border-border p-4" (submit)="submitAccept($event)">
          <h3 class="text-sm font-semibold">{{ 'pipeline.actions.accept_sales_handoff' | t }}</h3>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label appLabel for="accept-action" required>{{ 'crm.leads.workflow.firstAction' | t }}</label>
              <input appInput id="accept-action" class="mt-1.5" [value]="firstAction()" (input)="firstAction.set($any($event.target).value)" />
            </div>
            <div>
              <label appLabel for="accept-at" required>{{ 'pipeline.control.dueAt' | t }}</label>
              <input appInput id="accept-at" type="datetime-local" class="mt-1.5" [value]="firstActionAt()" (input)="firstActionAt.set($any($event.target).value)" />
            </div>
          </div>
          <div class="flex gap-2">
            <button type="submit" appButton size="sm" [disabled]="busy() || !firstAction().trim() || !firstActionAt()">{{ 'pipeline.confirm' | t }}</button>
            <button type="button" appButton size="sm" variant="outline" (click)="form.set(null)">{{ 'common.actions.cancel' | t }}</button>
          </div>
        </form>
      }
      @case ('reassign') {
        <form class="flex flex-col gap-3 rounded-md border border-border p-4" (submit)="submitReassign($event)">
          <h3 class="text-sm font-semibold">{{ 'pipeline.actions.reassign_sales_handoff' | t }}</h3>
          <div class="max-w-sm">
            <label appLabel for="reassign-to" required>{{ 'crm.leads.workflow.receiver' | t }}</label>
            <app-user-select class="mt-1.5" inputId="reassign-to" roles="sales_representative" [value]="handoffTo()" (valueChange)="handoffTo.set($event)" />
          </div>
          <div>
            <label appLabel for="reassign-reason" required>{{ 'pipeline.reason' | t }}</label>
            <textarea appTextarea id="reassign-reason" rows="2" class="mt-1.5" [value]="reassignReason()" (input)="reassignReason.set($any($event.target).value)"></textarea>
          </div>
          <div class="flex gap-2">
            <button type="submit" appButton size="sm" [disabled]="busy() || !handoffTo() || !reassignReason().trim()">{{ 'pipeline.confirm' | t }}</button>
            <button type="button" appButton size="sm" variant="outline" (click)="form.set(null)">{{ 'common.actions.cancel' | t }}</button>
          </div>
        </form>
      }
    }
  `,
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

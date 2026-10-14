import { Component, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom, type Observable } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { pipelineErrorText } from '../../../shared/crm/pipeline-tracker/pipeline-error';
import { PipelineTrackerComponent, type PipelineActionRequest } from '../../../shared/crm/pipeline-tracker/pipeline-tracker.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { SelectDirective } from '../../../shared/ui/form/select.directive';
import { CustomersApi } from '../customers-api.service';

/**
 * C0–C2 lifecycle: verification (verified with its method, or pending with a
 * reason; a possible duplicate is kept separate only explicitly), activation
 * and reopening the enrichment. A lifecycle move never touches opportunities.
 */
@Component({
  selector: 'app-customer-workflow-panel',
  imports: [TranslatePipe, PipelineTrackerComponent, ButtonDirective, InputDirective, LabelComponent, SelectComponent, SelectDirective],
  template: `
    @if (workflow.hasValue()) {
      <app-pipeline-tracker [view]="workflow.value()" [formActions]="['record_verification']" [busy]="busy()" [error]="error()" (act)="onAction($event)" />
    }
    @if (verifying()) {
      <form class="flex flex-col gap-3 rounded-md border border-border p-4" (submit)="submitVerification($event)">
        <h3 class="text-sm font-semibold">{{ 'pipeline.actions.record_verification' | t }}</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label appLabel for="verification-state" required>{{ 'crm.customers.workflow.state' | t }}</label>
            <app-select class="mt-1.5">
              <select appSelect id="verification-state" [value]="state()" (change)="state.set($any($event.target).value)">
                <option value="verified">{{ 'crm.customers.workflow.states.verified' | t }}</option>
                <option value="pending">{{ 'crm.customers.workflow.states.pending' | t }}</option>
              </select>
            </app-select>
          </div>
          @if (state() === 'verified') {
            <div>
              <label appLabel for="verification-method" required>{{ 'crm.customers.workflow.method' | t }}</label>
              <app-select class="mt-1.5">
                <select appSelect id="verification-method" [value]="method()" (change)="method.set($any($event.target).value)">
                  @for (option of methods; track option) {
                    <option [value]="option">{{ 'crm.customers.workflow.methods.' + option | t }}</option>
                  }
                </select>
              </app-select>
            </div>
          } @else {
            <div>
              <label appLabel for="verification-reason" required>{{ 'pipeline.reason' | t }}</label>
              <input appInput id="verification-reason" class="mt-1.5" [value]="reason()" (input)="reason.set($any($event.target).value)" />
            </div>
          }
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" class="size-4 rounded border-input accent-primary" [checked]="keepSeparate()" (change)="keepSeparate.set($any($event.target).checked)" />
          {{ 'crm.customers.workflow.keepSeparate' | t }}
        </label>
        <div class="flex gap-2">
          <button type="submit" appButton size="sm" [disabled]="busy() || (state() === 'pending' && !reason().trim())">{{ 'pipeline.confirm' | t }}</button>
          <button type="button" appButton size="sm" variant="outline" (click)="verifying.set(false)">{{ 'common.actions.cancel' | t }}</button>
        </div>
      </form>
    }
  `,
  host: { class: 'flex flex-col gap-4' },
})
export class CustomerWorkflowPanelComponent {
  private readonly api = inject(CustomersApi);
  private readonly i18n = inject(I18nService);

  readonly customerId = input.required<string>();
  readonly version = input<string | undefined>();
  readonly changed = output<void>();

  protected readonly methods = ['phone_call', 'site_visit', 'document', 'email', 'other'];
  protected readonly workflow = rxResource({
    params: () => ({ id: this.customerId(), at: this.version() }),
    stream: ({ params }) => this.api.workflow(params.id),
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly verifying = signal(false);
  protected readonly state = signal<'verified' | 'pending'>('verified');
  protected readonly method = signal('phone_call');
  protected readonly reason = signal('');
  protected readonly keepSeparate = signal(false);

  protected onAction(request: PipelineActionRequest): void {
    this.error.set(null);
    if (request.action === 'record_verification') this.verifying.set(true);
    else if (request.action === 'activate_relationship' || request.action === 'reopen_enrichment')
      void this.run(() => this.api.lifecycle(this.customerId(), { action: request.action as 'activate_relationship' | 'reopen_enrichment', reason: request.reason }));
  }

  protected submitVerification(event: Event): void {
    event.preventDefault();
    void this.run(() =>
      this.api.verify(this.customerId(), {
        state: this.state(),
        method: this.state() === 'verified' ? this.method() : undefined,
        reason: this.reason().trim() || undefined,
        keepSeparate: this.keepSeparate() || undefined,
      }),
    );
  }

  private async run(call: () => Observable<unknown>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(call());
      this.verifying.set(false);
      this.workflow.reload();
      this.changed.emit();
    } catch (error: unknown) {
      this.error.set(pipelineErrorText(this.i18n, error));
    } finally {
      this.busy.set(false);
    }
  }
}

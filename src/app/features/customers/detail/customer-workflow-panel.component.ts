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
  templateUrl: './customer-workflow-panel.component.html',
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

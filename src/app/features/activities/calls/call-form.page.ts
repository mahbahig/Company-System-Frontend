import { Component, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { RecordPickerComponent } from '../../../shared/crm/record-picker/record-picker.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { ActivitiesApi } from '../activities-api.service';

/**
 * E11 log a call (mobile-friendly). Linked to a customer, lead or
 * opportunity (prefilled from `?customerId=` etc.); a follow-up creates a
 * linked task automatically.
 */
@Component({
  selector: 'app-call-form-page',
  imports: [TranslatePipe, EnumLabelPipe, RecordPickerComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-page-header [heading]="'act.calls.new' | t" class="!mb-0" />
    <form appCard class="max-w-3xl" (submit)="save($event)">
      <div appCardContent class="grid gap-4 sm:grid-cols-2">
        @if (actions.error(); as text) {
          <app-alert variant="destructive" class="sm:col-span-2">{{ text }}</app-alert>
        }
        <div>
          <label appLabel for="call-customer">{{ 'act.fields.customer' | t }}</label>
          <app-record-picker kind="customer" inputId="call-customer" [(value)]="customer" />
        </div>
        <div>
          <label appLabel for="call-lead">{{ 'act.fields.lead' | t }}</label>
          <app-record-picker kind="lead" inputId="call-lead" [(value)]="lead" />
        </div>
        <div>
          <label appLabel for="call-opp">{{ 'act.fields.opportunity' | t }}</label>
          <app-record-picker kind="opportunity" inputId="call-opp" [parentId]="customer() || undefined" [(value)]="opportunity" />
        </div>
        @if (customer()) {
          <div>
            <label appLabel for="call-contact">{{ 'act.fields.contact' | t }}</label>
            <app-record-picker kind="contact" inputId="call-contact" [parentId]="customer()" [(value)]="contact" />
          </div>
        }
        <div>
          <label appLabel for="call-direction" required>{{ 'act.columns.direction' | t }}</label>
          <app-select>
            <select appSelect id="call-direction" [value]="form().direction" (change)="set('direction', $any($event.target).value)">
              <option value="outbound">{{ 'outbound' | enum: 'callDirection' }}</option>
              <option value="inbound">{{ 'inbound' | enum: 'callDirection' }}</option>
            </select>
          </app-select>
        </div>
        <div>
          <label appLabel for="call-at">{{ 'act.columns.when' | t }}</label>
          <input appInput id="call-at" type="datetime-local" dir="ltr" [value]="form().occurredAt" (change)="set('occurredAt', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="call-phone">{{ 'act.columns.phone' | t }}</label>
          <input appInput id="call-phone" type="tel" dir="ltr" [value]="form().phoneNumber" (input)="set('phoneNumber', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="call-duration">{{ 'act.fields.durationMinutes' | t }}</label>
          <input appInput id="call-duration" type="number" min="0" dir="ltr" [value]="form().durationMinutes" (input)="set('durationMinutes', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="call-purpose">{{ 'act.fields.purpose' | t }}</label>
          <app-select>
            <select appSelect id="call-purpose" [value]="form().purposeCode" (change)="set('purposeCode', $any($event.target).value)">
              <option value="">{{ 'crm.common.selectPlaceholder' | t }}</option>
              @for (option of reference.options('call_purpose'); track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </app-select>
        </div>
        <div>
          <label appLabel for="call-outcome" required>{{ 'act.columns.outcome' | t }}</label>
          <app-select>
            <select appSelect id="call-outcome" [value]="form().outcomeCode" (change)="set('outcomeCode', $any($event.target).value)">
              <option value="">{{ 'crm.common.selectPlaceholder' | t }}</option>
              @for (option of reference.options('call_outcome'); track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </app-select>
        </div>
        <div class="sm:col-span-2">
          <label appLabel for="call-summary">{{ 'act.fields.summary' | t }}</label>
          <textarea appTextarea id="call-summary" rows="3" [value]="form().summary" (input)="set('summary', $any($event.target).value)"></textarea>
        </div>
        <label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" [checked]="form().followUpRequired" (change)="set('followUpRequired', $any($event.target).checked)" /> {{ 'act.fields.followUpRequired' | t }}</label>
        @if (form().followUpRequired) {
          <div>
            <label appLabel for="call-fu" required>{{ 'act.columns.followUp' | t }}</label>
            <input appInput id="call-fu" type="datetime-local" dir="ltr" [value]="form().followUpAt" (change)="set('followUpAt', $any($event.target).value)" />
          </div>
          <div>
            <label appLabel for="call-next">{{ 'act.fields.nextAction' | t }}</label>
            <input appInput id="call-next" [value]="form().nextAction" (input)="set('nextAction', $any($event.target).value)" />
          </div>
        }
        <button type="submit" appButton class="self-start" [disabled]="actions.busy() || !form().outcomeCode || !(customer() || lead() || opportunity())">{{ 'crm.common.save' | t }}</button>
      </div>
    </form>
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class CallFormPage {
  private readonly api = inject(ActivitiesApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly customerId = input<string>();
  readonly leadId = input<string>();
  readonly opportunityId = input<string>();

  protected readonly customer = linkedSignal(() => this.customerId() ?? '');
  protected readonly lead = linkedSignal(() => this.leadId() ?? '');
  protected readonly opportunity = linkedSignal(() => this.opportunityId() ?? '');
  protected readonly contact = signal('');
  protected readonly form = signal({ direction: 'outbound', occurredAt: '', phoneNumber: '', durationMinutes: '', purposeCode: '', outcomeCode: '', summary: '', followUpRequired: false, followUpAt: '', nextAction: '' });

  constructor() {
    void this.reference.load();
  }

  protected set(key: string, value: unknown): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    const f = this.form();
    void this.actions.run(
      this.api.createCall({
        customerId: this.customer() || undefined,
        leadId: this.lead() || undefined,
        opportunityId: this.opportunity() || undefined,
        contactId: this.contact() || undefined,
        direction: f.direction,
        occurredAt: f.occurredAt ? new Date(f.occurredAt).toISOString() : undefined,
        phoneNumber: f.phoneNumber || undefined,
        durationSeconds: f.durationMinutes ? Number(f.durationMinutes) * 60 : undefined,
        purposeCode: f.purposeCode || undefined,
        outcomeCode: f.outcomeCode,
        summary: f.summary || undefined,
        followUpRequired: f.followUpRequired,
        followUpAt: f.followUpRequired && f.followUpAt ? new Date(f.followUpAt).toISOString() : undefined,
        nextAction: f.nextAction || undefined,
      }),
      null,
      (call) => void this.router.navigate(['/', this.i18n.locale(), 'calls', call.id]),
    );
  }
}

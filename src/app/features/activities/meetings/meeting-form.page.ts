import { Component, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RecordPickerComponent } from '../../../shared/crm/record-picker/record-picker.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { ActivitiesApi } from '../activities-api.service';

interface Attendee {
  userId?: string;
  contactId?: string;
  externalName?: string;
  externalRole?: string;
}

/** E12 schedule a meeting with internal, contact and external attendees. */
@Component({
  selector: 'app-meeting-form-page',
  imports: [TranslatePipe, EnumLabelPipe, RecordPickerComponent, UserSelectComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-page-header [heading]="'act.meetings.new' | t" class="!mb-0" />
    <form appCard class="max-w-3xl" (submit)="save($event)">
      <div appCardContent class="grid gap-4 sm:grid-cols-2">
        @if (actions.error(); as text) {
          <app-alert variant="destructive" class="sm:col-span-2">{{ text }}</app-alert>
        }
        <div class="sm:col-span-2">
          <label appLabel for="mt-subject" required>{{ 'act.fields.subject' | t }}</label>
          <input appInput id="mt-subject" [value]="form().subject" (input)="set('subject', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="mt-customer" required>{{ 'act.fields.customer' | t }}</label>
          <app-record-picker kind="customer" inputId="mt-customer" [(value)]="customer" />
        </div>
        <div>
          <label appLabel for="mt-opp">{{ 'act.fields.opportunity' | t }}</label>
          <app-record-picker kind="opportunity" inputId="mt-opp" [parentId]="customer() || undefined" [(value)]="opportunity" />
        </div>
        <div>
          <label appLabel for="mt-at" required>{{ 'act.columns.when' | t }}</label>
          <input appInput id="mt-at" type="datetime-local" dir="ltr" [value]="form().scheduledAt" (change)="set('scheduledAt', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="mt-ends">{{ 'act.fields.endsAt' | t }}</label>
          <input appInput id="mt-ends" type="datetime-local" dir="ltr" [value]="form().endsAt" (change)="set('endsAt', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="mt-mode">{{ 'act.fields.mode' | t }}</label>
          <app-select>
            <select appSelect id="mt-mode" [value]="form().mode" (change)="set('mode', $any($event.target).value)">
              @for (mode of ['in_person', 'online', 'hybrid', 'phone']; track mode) {
                <option [value]="mode">{{ mode | enum: 'meetingMode' }}</option>
              }
            </select>
          </app-select>
        </div>
        <div>
          @if (form().mode === 'online' || form().mode === 'hybrid') {
            <label appLabel for="mt-url">{{ 'act.fields.onlineUrl' | t }}</label>
            <input appInput id="mt-url" type="url" dir="ltr" [value]="form().onlineUrl" (input)="set('onlineUrl', $any($event.target).value)" />
          } @else {
            <label appLabel for="mt-location">{{ 'act.fields.location' | t }}</label>
            <input appInput id="mt-location" [value]="form().location" (input)="set('location', $any($event.target).value)" />
          }
        </div>
        <div class="sm:col-span-2">
          <label appLabel for="mt-agenda">{{ 'act.fields.agenda' | t }}</label>
          <textarea appTextarea id="mt-agenda" rows="3" [value]="form().agenda" (input)="set('agenda', $any($event.target).value)"></textarea>
        </div>
        <fieldset class="flex flex-col gap-2 sm:col-span-2">
          <legend class="mb-1 text-sm font-medium">{{ 'act.fields.attendees' | t }}</legend>
          @for (a of attendees(); track $index; let index = $index) {
            <div class="grid gap-2 sm:grid-cols-4">
              <app-user-select [placeholder]="'act.fields.internalAttendee' | t" [value]="a.userId ?? ''" (valueChange)="setAttendee(index, 'userId', $event)" />
              <input appInput [attr.aria-label]="'act.fields.externalName' | t" [placeholder]="'act.fields.externalName' | t" [value]="a.externalName ?? ''" (input)="setAttendee(index, 'externalName', $any($event.target).value)" />
              <input appInput [attr.aria-label]="'act.fields.externalRole' | t" [placeholder]="'act.fields.externalRole' | t" [value]="a.externalRole ?? ''" (input)="setAttendee(index, 'externalRole', $any($event.target).value)" />
              <button type="button" appButton variant="ghost" size="sm" (click)="removeAttendee(index)">{{ 'crm.common.delete' | t }}</button>
            </div>
          }
          <button type="button" appButton variant="outline" size="sm" class="self-start" (click)="attendees.update((rows) => [...rows, {}])">{{ 'act.fields.addAttendee' | t }}</button>
        </fieldset>
        <button type="submit" appButton class="self-start" [disabled]="actions.busy() || !form().subject.trim() || !customer() || !form().scheduledAt">{{ 'crm.common.save' | t }}</button>
      </div>
    </form>
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class MeetingFormPage {
  private readonly api = inject(ActivitiesApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly customerId = input<string>();
  readonly opportunityId = input<string>();

  protected readonly customer = linkedSignal(() => this.customerId() ?? '');
  protected readonly opportunity = linkedSignal(() => this.opportunityId() ?? '');
  protected readonly attendees = signal<Attendee[]>([]);
  protected readonly form = signal({ subject: '', scheduledAt: '', endsAt: '', mode: 'in_person', location: '', onlineUrl: '', agenda: '' });

  protected set(key: string, value: string): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected setAttendee(index: number, key: keyof Attendee, value: string): void {
    this.attendees.update((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value || undefined } : row)));
  }

  protected removeAttendee(index: number): void {
    this.attendees.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected save(event: Event): void {
    event.preventDefault();
    const f = this.form();
    void this.actions.run(
      this.api.createMeeting({
        subject: f.subject.trim(),
        customerId: this.customer(),
        opportunityId: this.opportunity() || undefined,
        scheduledAt: new Date(f.scheduledAt).toISOString(),
        endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : undefined,
        mode: f.mode,
        location: f.location || undefined,
        onlineUrl: f.onlineUrl || undefined,
        agenda: f.agenda || undefined,
        attendees: this.attendees().filter((a) => a.userId || a.contactId || a.externalName),
      }),
      null,
      (meeting) => void this.router.navigate(['/', this.i18n.locale(), 'meetings', meeting.id]),
    );
  }
}

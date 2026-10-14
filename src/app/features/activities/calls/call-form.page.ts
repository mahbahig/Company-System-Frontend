import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UnsavedChanges, type HasUnsavedChanges } from '../../../core/forms/unsaved-changes';
import { SaveShortcutDirective } from '../../../core/shortcuts/save-shortcut.directive';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';

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

const EMPTY_FORM = { direction: 'outbound', occurredAt: '', phoneNumber: '', durationMinutes: '', purposeCode: '', outcomeCode: '', summary: '', followUpRequired: false, followUpAt: '', nextAction: '' };

/**
 * E11 log a call (mobile-friendly). Linked to a customer, lead or
 * opportunity (prefilled from `?customerId=` etc.); a follow-up creates a
 * linked task automatically.
 */
@Component({
  selector: 'app-call-form-page',
  imports: [SaveShortcutDirective, BreadcrumbsComponent, TranslatePipe, EnumLabelPipe, RecordPickerComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-breadcrumbs [items]="crumbs()" />
    <app-page-header [heading]="'act.calls.new' | t" class="!mb-0" />
    <form appCard class="max-w-3xl" appSaveShortcut (submit)="save($event)">
      <div appCardContent class="grid gap-4 sm:grid-cols-2">
        @if (actions.error(); as text) {
          <app-alert variant="destructive" class="sm:col-span-2">{{ text }}</app-alert>
        }
        <div>
          <label appLabel for="call-customer">{{ 'act.fields.customer' | t }}</label>
          <app-record-picker kind="customer" inputId="call-customer" [(value)]="customer" />
        </div>
        <div>
          <label appLabel for="call-lead" required>{{ 'act.fields.lead' | t }}</label>
          <app-record-picker kind="lead" inputId="call-lead" [(value)]="lead" [attr.aria-invalid]="leadError() ? true : null" />
          @if (leadError(); as key) {
            <p id="call-lead-error" class="mt-1 text-sm text-destructive">{{ key | t }}</p>
          }
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
          <input
            appInput
            id="call-duration"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            dir="ltr"
            placeholder="15"
            [value]="form().durationMinutes"
            (input)="set('durationMinutes', $any($event.target).value)"
            (blur)="durationTouched.set(true)"
            [attr.aria-invalid]="durationError() ? true : null"
            [attr.aria-describedby]="durationError() ? 'call-duration-error' : 'call-duration-hint'"
          />
          @if (durationError(); as key) {
            <p id="call-duration-error" class="mt-1 text-sm text-destructive">{{ key | t }}</p>
          } @else {
            <p id="call-duration-hint" class="mt-1 text-xs text-muted-foreground">{{ 'ux.forms.durationHint' | t }}</p>
          }
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
        <div class="flex flex-col gap-1.5 sm:col-span-2">
          <button type="submit" appButton class="self-start" [disabled]="actions.busy() || !!missing()" [attr.aria-describedby]="missing() ? 'calls-form-why' : null" aria-keyshortcuts="Control+S Meta+S">{{ (actions.busy() ? 'crm.common.saving' : 'crm.common.save') | t }}</button>
          @if (missing(); as key) {
            <p id="calls-form-why" class="text-xs text-muted-foreground">{{ key | t }}</p>
          }
        </div>
      </div>
    </form>
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class CallFormPage implements HasUnsavedChanges {
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
  protected readonly form = signal({ ...EMPTY_FORM });

  private saved = false;
  protected readonly crumbs = computed(() => [{ label: this.i18n.t('navigation.items.calls'), path: '/calls' }, { label: this.i18n.t('act.calls.new') }]);
  /** Why Save is unavailable, in words (instead of a silently disabled button). */
  /** What still blocks Save, in words: a lead and an outcome are required, and a duration must be a number. */
  protected readonly missing = computed(() => {
    if (!this.lead()) return 'ux.forms.callNeedsLead';
    if (!this.form().outcomeCode) return 'ux.forms.callNeedsOutcome';
    if (parseMinutes(this.form().durationMinutes) === 'invalid') return 'ux.validation.duration';
    return null;
  });
  protected readonly durationTouched = signal(false);
  protected readonly attempted = signal(false);
  protected readonly durationError = computed(() =>
    (this.durationTouched() || this.attempted()) && parseMinutes(this.form().durationMinutes) === 'invalid' ? 'ux.validation.duration' : null,
  );
  protected readonly leadError = computed(() => (this.attempted() && !this.lead() ? 'ux.validation.leadRequired' : null));

  hasUnsavedChanges(): boolean {
    return !this.saved && (JSON.stringify(this.form()) !== JSON.stringify(EMPTY_FORM) || this.customer() !== (this.customerId() ?? '') || this.lead() !== (this.leadId() ?? '') || this.opportunity() !== (this.opportunityId() ?? ''));
  }

  constructor() {
    void this.reference.load();
    inject(UnsavedChanges).track(() => this.hasUnsavedChanges());
  }

  protected set(key: string, value: unknown): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    this.attempted.set(true);
    if (this.missing() || this.actions.busy()) return;
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
        durationSeconds: secondsOf(f.durationMinutes),
        purposeCode: f.purposeCode || undefined,
        outcomeCode: f.outcomeCode,
        summary: f.summary || undefined,
        followUpRequired: f.followUpRequired,
        followUpAt: f.followUpRequired && f.followUpAt ? new Date(f.followUpAt).toISOString() : undefined,
        nextAction: f.nextAction || undefined,
      }),
      null,
      (call) => {
        this.saved = true;
        // Back to the calls table, where the new call appears under the list's normal sorting.
        void this.router.navigate(['/', this.i18n.locale(), 'calls']);
      },
    );
  }
}

/**
 * The duration field is free text: blank (no duration), or minutes as a
 * plain number — `15`, `2.5` (Arabic-Indic digits and a comma decimal are
 * accepted) — up to 24 h. Anything else is invalid, and the API re-checks it.
 */
function parseMinutes(raw: string): number | null | 'invalid' {
  const text = raw
    .trim()
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[,٫]/, '.');
  if (!text) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'invalid';
  const minutes = Number(text);
  return minutes > 1440 ? 'invalid' : minutes;
}

/** Minutes → whole seconds for the API (`durationSeconds`). */
function secondsOf(raw: string): number | undefined {
  const minutes = parseMinutes(raw);
  return typeof minutes === 'number' ? Math.round(minutes * 60) : undefined;
}

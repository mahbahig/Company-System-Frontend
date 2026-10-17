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

/** What a call is about: exactly one of them (the API refuses neither and both). */
type CallParty = 'customer' | 'lead';

const EMPTY_FORM = { direction: 'outbound', occurredAt: '', phoneNumber: '', durationMinutes: '', purposeCode: '', outcomeCode: '', summary: '', followUpRequired: false, followUpAt: '', nextAction: '' };

/**
 * E11 log a call (mobile-friendly). The user chooses what the call was about
 * — a customer (optionally with its opportunity / contact) OR a lead, never
 * both — and only that side is sent; opened from a customer, opportunity or
 * lead (`?customerId=` / `?opportunityId=` / `?leadId=`) the choice is made
 * already. A follow-up creates a linked task automatically.
 */
@Component({
  selector: 'app-call-form-page',
  imports: [SaveShortcutDirective, BreadcrumbsComponent, TranslatePipe, EnumLabelPipe, RecordPickerComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './call-form.page.html',
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

  /** The party the call is about: from the link that opened the form, else the user's explicit choice. */
  protected readonly party = linkedSignal<CallParty | null>(() => {
    const customer = !!(this.customerId() || this.opportunityId());
    const lead = !!this.leadId();
    return customer === lead ? null : customer ? 'customer' : 'lead';
  });
  protected readonly customer = linkedSignal(() => this.customerId() ?? '');
  protected readonly lead = linkedSignal(() => this.leadId() ?? '');
  protected readonly opportunity = linkedSignal(() => this.opportunityId() ?? '');
  protected readonly contact = signal('');
  protected readonly form = signal({ ...EMPTY_FORM });

  private saved = false;
  protected readonly crumbs = computed(() => [{ label: this.i18n.t('navigation.items.calls'), path: '/calls' }, { label: this.i18n.t('act.calls.new') }]);
  /** What still blocks Save, in words: exactly one party (customer OR lead) and an outcome are required, and a duration must be a number. */
  protected readonly missing = computed(() => {
    const party = this.party();
    if (!party) return 'ux.forms.callNeedsParty';
    if (party === 'customer' && !this.customer()) return 'ux.forms.callNeedsCustomer';
    if (party === 'lead' && !this.lead()) return 'ux.forms.callNeedsLead';
    if (!this.form().outcomeCode) return 'ux.forms.callNeedsOutcome';
    if (parseMinutes(this.form().durationMinutes) === 'invalid') return 'ux.validation.duration';
    return null;
  });
  protected readonly durationTouched = signal(false);
  protected readonly attempted = signal(false);
  protected readonly durationError = computed(() =>
    (this.durationTouched() || this.attempted()) && parseMinutes(this.form().durationMinutes) === 'invalid' ? 'ux.validation.duration' : null,
  );
  /** The client check, else the API's verdict on the party (e.g. `validation.callPartyExclusive`). */
  protected readonly partyError = computed(() => {
    if (this.attempted() && !this.party()) return 'ux.validation.partyRequired';
    const server = this.actions.fieldErrors();
    return server['customerId'] ?? server['leadId'] ?? null;
  });
  protected readonly customerError = computed(() => (this.attempted() && this.party() === 'customer' && !this.customer() ? 'ux.validation.customerRequired' : null));
  protected readonly leadError = computed(() => (this.attempted() && this.party() === 'lead' && !this.lead() ? 'ux.validation.leadRequired' : null));

  hasUnsavedChanges(): boolean {
    return (
      !this.saved &&
      (JSON.stringify(this.form()) !== JSON.stringify(EMPTY_FORM) ||
        this.customer() !== (this.customerId() ?? '') ||
        this.lead() !== (this.leadId() ?? '') ||
        this.opportunity() !== (this.opportunityId() ?? '') ||
        !!this.contact())
    );
  }

  constructor() {
    void this.reference.load();
    inject(UnsavedChanges).track(() => this.hasUnsavedChanges());
  }

  /** Switching the party drops the other side's picks, so they can never be sent together. */
  protected choose(party: CallParty): void {
    this.party.set(party);
    if (party === 'lead') {
      this.customer.set('');
      this.opportunity.set('');
      this.contact.set('');
    } else {
      this.lead.set('');
    }
  }

  protected set(key: string, value: unknown): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    this.attempted.set(true);
    if (this.missing() || this.actions.busy()) return;
    const f = this.form();
    const forCustomer = this.party() === 'customer';
    void this.actions.run(
      this.api.createCall({
        // Only the chosen party's ids: a customer (with its opportunity / contact) or a lead.
        customerId: forCustomer ? this.customer() : undefined,
        leadId: forCustomer ? undefined : this.lead(),
        opportunityId: forCustomer ? this.opportunity() || undefined : undefined,
        contactId: forCustomer ? this.contact() || undefined : undefined,
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
        void this.router.navigate(['/', 'calls']);
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

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

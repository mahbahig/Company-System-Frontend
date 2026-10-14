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

const PURPOSES = ['survey', 'technical_assessment', 'presentation', 'installation_check', 'follow_up', 'other'];

const EMPTY_FORM = { purpose: 'survey', visitTypeCode: '', scheduledAt: '', plannedAddress: '' };

/**
 * E13 schedule a site visit. A submission key makes a retried submit (poor
 * connectivity on site) create the visit only once (VISIT-03).
 */
@Component({
  selector: 'app-visit-form-page',
  imports: [SaveShortcutDirective, BreadcrumbsComponent, TranslatePipe, EnumLabelPipe, RecordPickerComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-breadcrumbs [items]="crumbs()" />
    <app-page-header [heading]="'act.visits.new' | t" class="!mb-0" />
    <form appCard class="max-w-3xl" appSaveShortcut (submit)="save($event)">
      <div appCardContent class="grid gap-4 sm:grid-cols-2">
        @if (actions.error(); as text) {
          <app-alert variant="destructive" class="sm:col-span-2">{{ text }}</app-alert>
        }
        <div>
          <label appLabel for="vs-customer" required>{{ 'act.fields.customer' | t }}</label>
          <app-record-picker kind="customer" inputId="vs-customer" [(value)]="customer" />
        </div>
        <div>
          <label appLabel for="vs-opp">{{ 'act.fields.opportunity' | t }}</label>
          <app-record-picker kind="opportunity" inputId="vs-opp" [parentId]="customer() || undefined" [(value)]="opportunity" />
        </div>
        @if (customer()) {
          <div>
            <label appLabel for="vs-site">{{ 'act.fields.site' | t }}</label>
            <app-record-picker kind="site" inputId="vs-site" [parentId]="customer()" [(value)]="site" />
          </div>
          <div>
            <label appLabel for="vs-contact">{{ 'act.fields.contact' | t }}</label>
            <app-record-picker kind="contact" inputId="vs-contact" [parentId]="customer()" [(value)]="contact" />
          </div>
        }
        <div>
          <label appLabel for="vs-purpose" required>{{ 'act.fields.purpose' | t }}</label>
          <app-select>
            <select appSelect id="vs-purpose" [value]="form().purpose" (change)="set('purpose', $any($event.target).value)">
              @for (purpose of purposes; track purpose) {
                <option [value]="purpose">{{ purpose | enum: 'visitPurpose' }}</option>
              }
            </select>
          </app-select>
        </div>
        <div>
          <label appLabel for="vs-type">{{ 'act.fields.visitType' | t }}</label>
          <app-select>
            <select appSelect id="vs-type" [value]="form().visitTypeCode" (change)="set('visitTypeCode', $any($event.target).value)">
              <option value="">—</option>
              @for (option of reference.options('visit_type'); track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </app-select>
        </div>
        <div>
          <label appLabel for="vs-at" required>{{ 'act.columns.when' | t }}</label>
          <input appInput id="vs-at" type="datetime-local" dir="ltr" [value]="form().scheduledAt" (change)="set('scheduledAt', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="vs-address">{{ 'act.fields.plannedAddress' | t }}</label>
          <input appInput id="vs-address" [value]="form().plannedAddress" (input)="set('plannedAddress', $any($event.target).value)" />
        </div>
        <label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" [checked]="needsAssessment()" (change)="needsAssessment.set($any($event.target).checked)" /> {{ 'act.fields.requiresTechnicalAssessment' | t }}</label>
        <div class="flex flex-col gap-1.5 sm:col-span-2">
          <button type="submit" appButton class="self-start" [disabled]="actions.busy() || !customer() || !form().scheduledAt" [attr.aria-describedby]="missing() ? 'visits-form-why' : null" aria-keyshortcuts="Control+S Meta+S">{{ (actions.busy() ? 'crm.common.saving' : 'crm.common.save') | t }}</button>
          @if (missing(); as key) {
            <p id="visits-form-why" class="text-xs text-muted-foreground">{{ key | t }}</p>
          }
        </div>
      </div>
    </form>
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class VisitFormPage implements HasUnsavedChanges {
  private readonly api = inject(ActivitiesApi);
  private readonly router = inject(Router);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly purposes = PURPOSES;
  private readonly submissionKey = crypto.randomUUID();

  readonly customerId = input<string>();
  readonly opportunityId = input<string>();

  protected readonly customer = linkedSignal(() => this.customerId() ?? '');
  protected readonly opportunity = linkedSignal(() => this.opportunityId() ?? '');
  protected readonly site = signal('');
  protected readonly contact = signal('');
  protected readonly needsAssessment = signal(false);
  protected readonly form = signal({ ...EMPTY_FORM });

  private saved = false;
  protected readonly crumbs = computed(() => [{ label: this.i18n.t('navigation.items.visits'), path: '/visits' }, { label: this.i18n.t('act.visits.new') }]);
  /** Why Save is unavailable, in words (instead of a silently disabled button). */
  protected readonly missing = computed(() => (!this.customer() || !this.form().scheduledAt ? 'ux.forms.visitNeeds' : null));

  hasUnsavedChanges(): boolean {
    return !this.saved && (JSON.stringify(this.form()) !== JSON.stringify(EMPTY_FORM) || this.customer() !== (this.customerId() ?? '') || this.opportunity() !== (this.opportunityId() ?? ''));
  }

  constructor() {
    void this.reference.load();
    inject(UnsavedChanges).track(() => this.hasUnsavedChanges());
  }

  protected set(key: string, value: string): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    const f = this.form();
    void this.actions.run(
      this.api.createVisit({
        customerId: this.customer(),
        opportunityId: this.opportunity() || undefined,
        siteId: this.site() || undefined,
        contactId: this.contact() || undefined,
        purpose: f.purpose,
        visitTypeCode: f.visitTypeCode || undefined,
        scheduledAt: new Date(f.scheduledAt).toISOString(),
        plannedAddress: f.plannedAddress || undefined,
        requiresTechnicalAssessment: this.needsAssessment(),
        submissionKey: this.submissionKey,
      }),
      null,
      (visit) => {
        this.saved = true;
        void this.router.navigate(['/', this.i18n.locale(), 'visits', visit.id]);
      },
    );
  }
}

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
  templateUrl: './visit-form.page.html',
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
        void this.router.navigate(['/', 'visits', visit.id]);
      },
    );
  }
}

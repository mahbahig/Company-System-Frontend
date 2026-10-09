import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { CompletenessPanelComponent } from '../../../shared/crm/completeness-panel/completeness-panel.component';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CardContentDirective } from '../../../shared/ui/card/card-content.directive';
import { CardHeaderDirective } from '../../../shared/ui/card/card-header.directive';
import { CardTitleDirective } from '../../../shared/ui/card/card-title.directive';
import { CardDirective } from '../../../shared/ui/card/card.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { SelectDirective } from '../../../shared/ui/form/select.directive';
import { TextareaDirective } from '../../../shared/ui/form/textarea.directive';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { StatusPageComponent } from '../../errors/status-page.component';
import { asUserRef } from '../../../shared/utils/display-name';
import { formatPhone } from '../../../shared/utils/format';
import { LeadsApi } from '../leads-api.service';
import type { Lead } from '../models/lead.interface';

interface AttemptModel {
  reached: boolean;
  notes: string;
  nextFollowUpAt: string;
  nextAction: string;
}

interface CloseModel {
  reason: 'unqualified' | 'invalid' | 'duplicate' | 'nurture' | '';
  comment: string;
  nurtureFollowUpAt: string;
  qualityCode: string;
}

/** Lead detail: contact log, qualification, close/reopen, completeness. */
@Component({
  selector: 'app-lead-detail-page',
  imports: [
    UserSelectComponent,
    RouterLink,
    FormField,
    TranslatePipe,
    PageHeaderComponent,
    DetailItemComponent,
    CompletenessPanelComponent,
    AlertComponent,
    BadgeComponent,
    ButtonDirective,
    StatusPageComponent,
    CardDirective,
    CardHeaderDirective,
    CardTitleDirective,
    CardContentDirective,
    InputDirective,
    LabelComponent,
    SelectComponent,
    SelectDirective,
    TextareaDirective,
  ],
  templateUrl: './lead-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class LeadDetailPage {
  private readonly leads = inject(LeadsApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  readonly id = input.required<string>();
  protected readonly formatPhone = formatPhone;

  protected readonly detail = rxResource({ params: () => this.id(), stream: ({ params }) => this.leads.get(params) });
  protected readonly lead = computed(() => this.detail.value()?.lead ?? null);
  protected readonly notFound = computed(() => {
    const error = this.detail.error();
    return ApiError.is(error) && (error.status === 404 || error.status === 400);
  });

  protected readonly isFinal = computed(() => {
    const status = this.lead()?.status;
    return status === 'converted' || status === 'closed';
  });
  protected readonly canReopen = computed(() => {
    const status = this.lead()?.status;
    return (status === 'closed' || status === 'nurture') && this.auth.can('leads.reopen');
  });
  protected readonly canQualify = computed(() => !this.isFinal() && this.lead()?.status !== 'qualified' && this.auth.can('leads.edit'));
  protected readonly canClose = computed(() => !this.isFinal() && this.auth.can('leads.close'));
  /** Assign / reassign from the lead itself (the bank lead does not need to be qualified first). */
  protected readonly canAssign = computed(() => !this.isFinal() && this.auth.can('leads.assign'));
  protected readonly assignOwner = signal('');
  protected readonly assignReason = signal('');
  protected readonly assigning = signal(false);
  /** LEAD-15: assigning beyond the rep's capacity needs an explicit override. */
  protected readonly assignOverride = signal(false);
  protected readonly canConvert = computed(() => !this.isFinal() && this.auth.can('leads.convert'));

  protected readonly showAttemptForm = signal(false);
  protected readonly showCloseForm = signal(false);
  protected readonly showReopenForm = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly actionMessage = signal<string | null>(null);

  // --- Contact attempt ------------------------------------------------------
  private readonly attemptModel = signal<AttemptModel>({ reached: false, notes: '', nextFollowUpAt: '', nextAction: '' });
  protected readonly attemptForm = form(this.attemptModel);

  protected async submitAttempt(event: Event): Promise<void> {
    event.preventDefault();
    this.actionError.set(null);
    const value = this.attemptModel();
    try {
      await firstValueFrom(
        this.leads.logAttempt(this.id(), {
          reached: value.reached,
          notes: value.notes || undefined,
          nextFollowUpAt: value.nextFollowUpAt || undefined,
          nextAction: value.nextAction || undefined,
        }),
      );
      this.actionMessage.set('crm.leads.attempt.logged');
      this.showAttemptForm.set(false);
      this.attemptModel.set({ reached: false, notes: '', nextFollowUpAt: '', nextAction: '' });
      this.detail.reload();
    } catch (error) {
      this.actionError.set(this.errorKey(error));
    }
  }

  /** The server's reason when it has a translation (e.g. missing required items), otherwise the generic message. */
  private errorKey(error: unknown): string {
    return ApiError.is(error) && this.i18n.has(error.messageKey) ? error.messageKey : 'errors.db.unexpected';
  }

  // --- Assign -----------------------------------------------------------------
  protected async assign(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.assignOwner() || !this.assignReason().trim()) return;
    this.actionError.set(null);
    this.assigning.set(true);
    try {
      await firstValueFrom(this.leads.assign({ leadIds: [this.id()], ownerId: this.assignOwner(), reason: this.assignReason().trim(), overrideCapacity: this.assignOverride() || undefined }));
      this.actionMessage.set('crm.leads.distribute.assigned');
      this.assignOwner.set('');
      this.assignReason.set('');
      this.assignOverride.set(false);
      this.detail.reload();
    } catch (error) {
      this.actionError.set(this.errorKey(error));
    } finally {
      this.assigning.set(false);
    }
  }

  // --- Qualify ----------------------------------------------------------------
  protected async qualify(): Promise<void> {
    this.actionError.set(null);
    try {
      await firstValueFrom(this.leads.qualify(this.id()));
      this.actionMessage.set('crm.leads.qualify.done');
      this.detail.reload();
    } catch (error) {
      this.actionError.set(this.errorKey(error));
    }
  }

  // --- Close ------------------------------------------------------------------
  private readonly closeModel = signal<CloseModel>({ reason: '', comment: '', nurtureFollowUpAt: '', qualityCode: '' });
  protected readonly closeForm = form(this.closeModel, (path) => {
    required(path.reason, { message: 'validation.required' });
    required(path.nurtureFollowUpAt, { message: 'validation.required', when: ({ valueOf }) => valueOf(path.reason) === 'nurture' });
  });
  protected readonly closeIsNurture = computed(() => this.closeModel().reason === 'nurture');

  protected async submitClose(event: Event): Promise<void> {
    event.preventDefault();
    this.closeForm().markAsTouched();
    if (this.closeForm().invalid()) return;
    this.actionError.set(null);
    const value = this.closeModel();
    try {
      await firstValueFrom(
        this.leads.close(this.id(), {
          reason: value.reason as 'unqualified' | 'invalid' | 'duplicate' | 'nurture',
          comment: value.comment || undefined,
          nurtureFollowUpAt: value.reason === 'nurture' ? value.nurtureFollowUpAt || undefined : undefined,
          qualityCode: value.qualityCode || undefined,
        }),
      );
      this.actionMessage.set('crm.leads.close.closed');
      this.showCloseForm.set(false);
      this.detail.reload();
    } catch (error) {
      this.actionError.set(this.errorKey(error));
    }
  }

  // --- Reopen -------------------------------------------------------------
  private readonly reopenModel = signal({ reason: '' });
  protected readonly reopenForm = form(this.reopenModel, (path) => required(path.reason, { message: 'validation.required' }));

  protected async submitReopen(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.reopenForm, async () => {
      this.actionError.set(null);
      try {
        await firstValueFrom(this.leads.reopen(this.id(), this.reopenModel().reason));
        this.actionMessage.set('crm.leads.reopen.reopened');
        this.showReopenForm.set(false);
        this.reopenModel.set({ reason: '' });
        this.detail.reload();
      } catch (error) {
        this.actionError.set(this.errorKey(error));
      }
      return undefined;
    });
  }

  protected ownerName(lead: Lead): string {
    const owner = asUserRef(lead.ownerId);
    return owner ? this.i18n.pick(owner.fullNameAr, owner.fullNameEn) : this.i18n.t('crm.common.unassigned');
  }

  constructor() {
    void this.reference.load();
  }
}

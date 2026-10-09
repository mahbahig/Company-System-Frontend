import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
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
import { LeadsApi } from '../leads-api.service';
import type { DuplicateMatches } from '../models/duplicate-matches.interface';
import type { QuickAddLeadPayload } from '../models/quick-add-lead.interface';

interface QuickAddModel {
  name: string;
  phone: string;
  companyName: string;
  governorateCode: string;
  sourceCode: string;
  requestedServiceCode: string;
  requirement: string;
  notes: string;
  logCall: boolean;
  outcomeCode: string;
  callNotes: string;
}

const EMPTY: QuickAddModel = {
  name: '',
  phone: '',
  companyName: '',
  governorateCode: '',
  sourceCode: '',
  requestedServiceCode: '',
  requirement: '',
  notes: '',
  logCall: false,
  outcomeCode: '',
  callNotes: '',
};

/** LEAD-06 Quick Add: one mobile-friendly screen for a self-sourced lead. */
@Component({
  selector: 'app-lead-quick-add-page',
  imports: [
    FormField,
    TranslatePipe,
    PageHeaderComponent,
    AlertComponent,
    BadgeComponent,
    ButtonDirective,
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
  templateUrl: './lead-quick-add.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class LeadQuickAddPage {
  private readonly leads = inject(LeadsApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  protected readonly errorKey = signal<string | null>(null);
  protected readonly duplicates = signal<DuplicateMatches | null>(null);

  private readonly model = signal<QuickAddModel>({ ...EMPTY });
  protected readonly quickAddForm = form(this.model, (path) => {
    required(path.name, { message: 'validation.required' });
    required(path.phone, { message: 'validation.required' });
    required(path.sourceCode, { message: 'validation.required' });
  });

  protected readonly showCallOutcome = computed(() => this.model().logCall);

  protected fieldError(field: 'name' | 'phone' | 'sourceCode'): string | null {
    const state = this.quickAddForm[field]();
    return state.touched() ? (state.errors()[0]?.message ?? null) : null;
  }

  protected async onSubmit(event: Event, confirmDuplicate = false): Promise<void> {
    event.preventDefault();
    this.quickAddForm().markAsTouched();
    if (this.quickAddForm().invalid()) return;
    this.errorKey.set(null);

    const value = this.model();
    const payload: QuickAddLeadPayload = {
      name: value.name,
      phone: value.phone,
      companyName: value.companyName || undefined,
      governorateCode: value.governorateCode || undefined,
      sourceCode: value.sourceCode,
      requestedServiceCode: value.requestedServiceCode || undefined,
      notes: value.notes || undefined,
      requirement: value.requirement || undefined,
      logCall: value.logCall ? { outcomeCode: value.outcomeCode, notes: value.callNotes || undefined } : undefined,
      confirmDuplicate: confirmDuplicate || undefined,
    };

    try {
      const lead = await firstValueFrom(this.leads.quickAdd(payload));
      await this.router.navigate(['/', this.i18n.locale(), 'leads', lead.id]);
    } catch (error) {
      if (ApiError.is(error) && error.status === 409) {
        this.duplicates.set((error.details as DuplicateMatches) ?? { customerMatches: [], leadMatches: [] });
        return;
      }
      this.errorKey.set(ApiError.is(error) && this.i18n.has(error.messageKey) ? error.messageKey : 'errors.db.unexpected');
    }
  }

  protected confirmAnyway(event: Event): void {
    void this.onSubmit(event, true);
  }

  protected cancelDuplicates(): void {
    this.duplicates.set(null);
  }
}

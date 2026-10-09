import { Component, inject, input, signal } from '@angular/core';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { LoaderCircle } from 'lucide';

import { ApiError } from '../../../core/api/api-error';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CardContentDirective } from '../../../shared/ui/card/card-content.directive';
import { CardDirective } from '../../../shared/ui/card/card.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { SelectDirective } from '../../../shared/ui/form/select.directive';
import { TextareaDirective } from '../../../shared/ui/form/textarea.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { CustomersApi } from '../customers-api.service';
import type { ContactCreate } from '../models/contact-create.interface';

const PREFERRED_CHANNELS = ['mobile', 'whatsapp', 'email', 'landline'] as const;
const DECISION_AUTHORITIES = ['final', 'recommends', 'none'] as const;

interface ContactFormModel {
  fullName: string;
  fullNameEn: string;
  roleCode: string;
  jobTitle: string;
  department: string;
  mobile: string;
  altPhone: string;
  email: string;
  preferredChannel: string;
  decisionAuthority: string;
  influenceLevel: number | null;
  isPrimary: boolean;
  hasWhatsapp: boolean;
  notes: string;
}

const EMPTY_MODEL: ContactFormModel = {
  fullName: '',
  fullNameEn: '',
  roleCode: '',
  jobTitle: '',
  department: '',
  mobile: '',
  altPhone: '',
  email: '',
  preferredChannel: '',
  decisionAuthority: '',
  influenceLevel: null,
  isPrimary: false,
  hasWhatsapp: false,
  notes: '',
};

/** `/customers/:id/contacts/new` — nested contact create (CONT-01). */
@Component({
  selector: 'app-contact-create-page',
  imports: [
    RouterLink,
    FormField,
    TranslatePipe,
    PageHeaderComponent,
    AlertComponent,
    ButtonDirective,
    InputDirective,
    LabelComponent,
    SelectComponent,
    SelectDirective,
    TextareaDirective,
    IconComponent,
    CardDirective,
    CardContentDirective,
  ],
  templateUrl: './contact-create.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ContactCreatePage {
  private readonly customers = inject(CustomersApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  readonly customerId = input.required<string>({ alias: 'id' });

  protected readonly channels = PREFERRED_CHANNELS;
  protected readonly authorities = DECISION_AUTHORITIES;
  protected readonly spinnerIcon = LoaderCircle;
  protected readonly errorKey = signal<string | null>(null);

  private readonly model = signal<ContactFormModel>(EMPTY_MODEL);
  protected readonly contactForm = form(this.model, (path) => {
    required(path.fullName, { message: 'crm.validation.contactNameRequired' });
    required(path.roleCode, { message: 'crm.validation.roleRequired' });
    required(path.mobile, { message: 'crm.validation.mobileRequired' });
    email(path.email, { message: 'crm.validation.invalidEmail' });
  });

  constructor() {
    void this.reference.load();
  }

  protected error(field: keyof ContactFormModel): string | null {
    const state = this.contactForm[field]();
    return state.touched() ? (state.errors()[0]?.message ?? null) : null;
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorKey.set(null);
    this.contactForm().markAsTouched();
    await submit(this.contactForm, async () => {
      const value = this.model();
      const body: ContactCreate = {
        fullName: value.fullName,
        fullNameEn: value.fullNameEn || undefined,
        roleCode: value.roleCode,
        jobTitle: value.jobTitle || undefined,
        department: value.department || undefined,
        mobile: value.mobile,
        otherPhones: value.altPhone ? [value.altPhone] : undefined,
        email: value.email || undefined,
        preferredChannel: value.preferredChannel || undefined,
        decisionAuthority: value.decisionAuthority || undefined,
        influenceLevel: value.influenceLevel ?? undefined,
        isPrimary: value.isPrimary,
        hasWhatsapp: value.hasWhatsapp,
        notes: value.notes || undefined,
      };
      try {
        await this.save(body);
        await this.router.navigateByUrl(`/${this.i18n.locale()}/customers/${this.customerId()}`);
      } catch (error) {
        this.errorKey.set(this.messageFor(error));
      }
      return undefined;
    });
  }

  private async save(body: ContactCreate): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.customers.createContact(this.customerId(), body).subscribe({ next: () => resolve(), error: (error: unknown) => reject(error) });
    });
  }

  private messageFor(error: unknown): string {
    if (!ApiError.is(error)) return 'auth.errors.unexpected';
    return this.i18n.has(error.messageKey) ? error.messageKey : 'auth.errors.unexpected';
  }
}

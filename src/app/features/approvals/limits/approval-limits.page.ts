import { Component, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { UnsavedChanges, type HasUnsavedChanges } from '../../../core/forms/unsaved-changes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SaveShortcutDirective } from '../../../core/shortcuts/save-shortcut.directive';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { focusFirstInvalid } from '../../../shared/utils/focus-invalid';

type Unit = 'pct' | 'egp' | 'hours';

interface LimitField {
  key: string;
  unit: Unit;
  min: number;
  max?: number;
  integer?: boolean;
}

/** The approval matrix's numbers, grouped by what they decide (keys and ranges as the API defines them). */
const SECTIONS: ReadonlyArray<{ id: string; fields: LimitField[] }> = [
  {
    id: 'discounts',
    fields: [
      { key: 'approval.discount.salesManagerMaxPct', unit: 'pct', min: 0, max: 100 },
      { key: 'approval.discount.cfoMaxPct', unit: 'pct', min: 0, max: 100 },
    ],
  },
  {
    id: 'margins',
    fields: [
      { key: 'approval.marginFloorPct', unit: 'pct', min: 0, max: 100 },
      { key: 'approval.paymentTerms.minDownPaymentPct', unit: 'pct', min: 0, max: 100 },
    ],
  },
  {
    id: 'values',
    fields: [
      { key: 'approval.contract.ceoAboveValue', unit: 'egp', min: 0 },
      { key: 'financialProposal.financeValidationAboveValue', unit: 'egp', min: 0 },
    ],
  },
  {
    id: 'timing',
    fields: [
      { key: 'approval.slaHours', unit: 'hours', min: 1, max: 720, integer: true },
      { key: 'approval.reminderBeforeHours', unit: 'hours', min: 0, max: 720, integer: true },
    ],
  },
];
const FIELDS = SECTIONS.flatMap((section) => section.fields);

/**
 * The approval limits inside Approvals: who must approve which discount,
 * margin, payment terms and contract value, and how fast. The values ARE the
 * system settings the approval matrix reads (`PATCH /settings`), so the server
 * applies its own per-key rule (business-policy keys need
 * `settings.manage_policy`, the timing keys `settings.manage`) and range checks;
 * a field the user may not change is shown read-only.
 */
@Component({
  selector: 'app-approval-limits-page',
  imports: [RouterLink, TranslatePipe, SaveShortcutDirective, BreadcrumbsComponent, AlertComponent, ButtonDirective, PageHeaderComponent, DetailSkeletonComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-breadcrumbs [items]="crumbs()" />
    <app-page-header [heading]="'ux.approvalLimits.title' | t" [subtitle]="'ux.approvalLimits.subtitle' | t" class="!mb-0" />

    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (data.isLoading() && !data.hasValue()) {
      <app-detail-skeleton [label]="'common.labels.loading' | t" />
    } @else if (data.hasValue()) {
      <form class="flex max-w-4xl flex-col gap-6" novalidate appSaveShortcut (submit)="save($event)">
        @if (actions.message(); as text) {
          <app-alert variant="success">{{ text }}</app-alert>
        }
        @if (actions.error(); as text) {
          <app-alert variant="destructive">{{ text }}</app-alert>
        }

        @for (section of sections; track section.id) {
          <section appCard [attr.aria-labelledby]="'limits-' + section.id">
            <div appCardHeader>
              <h2 appCardTitle [id]="'limits-' + section.id">{{ 'ux.approvalLimits.sections.' + section.id + '.title' | t }}</h2>
              <p appCardDescription>{{ 'ux.approvalLimits.sections.' + section.id + '.description' | t }}</p>
            </div>
            <div appCardContent class="grid gap-6 sm:grid-cols-2">
              @for (field of section.fields; track field.key) {
                <div>
                  <label appLabel [for]="fieldId(field)">{{ label(field) }}</label>
                  <div class="relative">
                    <input
                      appInput
                      type="text"
                      inputmode="decimal"
                      autocomplete="off"
                      dir="ltr"
                      class="pe-14 tabular"
                      [id]="fieldId(field)"
                      [value]="draft()[field.key] ?? ''"
                      [disabled]="!mayEdit(field.key)"
                      (keydown)="blockSign($event)"
                      (input)="set(field.key, $any($event.target).value)"
                      [attr.aria-invalid]="error(field) ? true : null"
                      [attr.aria-describedby]="fieldId(field) + '-help'"
                    />
                    <span class="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-medium text-muted-foreground" aria-hidden="true">{{ 'ux.approvalLimits.units.' + field.unit | t }}</span>
                  </div>
                  @if (error(field); as key) {
                    <p [id]="fieldId(field) + '-help'" class="mt-1.5 text-sm text-destructive">{{ key | t: rangeParams(field) }}</p>
                  } @else {
                    <p [id]="fieldId(field) + '-help'" class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {{ help(field) }}
                      @if (!mayEdit(field.key)) {
                        <span class="block">{{ 'ux.approvalLimits.readOnly' | t }}</span>
                      }
                    </p>
                  }
                </div>
              }
            </div>
          </section>
        }

        <div class="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button type="submit" appButton [disabled]="actions.busy() || !dirty() || !canEditAny()" aria-keyshortcuts="Control+S Meta+S">
            {{ (actions.busy() ? 'crm.common.saving' : 'crm.common.save') | t }}
          </button>
          <button type="button" appButton variant="ghost" [disabled]="actions.busy() || !dirty()" (click)="reset()">{{ 'ux.approvalLimits.discard' | t }}</button>
          <a appButton variant="link" [routerLink]="['..']">{{ 'ux.approvalLimits.back' | t }}</a>
        </div>
      </form>
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class ApprovalLimitsPage implements HasUnsavedChanges {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly sections = SECTIONS;

  protected readonly data = rxResource({ stream: () => this.api.get<Record<string, unknown>>('settings') });
  private readonly meta = rxResource({ stream: () => this.api.get<{ policyKeys: string[] }>('settings/meta') });
  /** Field text as typed (validated before it is sent). */
  protected readonly draft = signal<Record<string, string>>({});
  private readonly saved = signal<Record<string, string>>({});
  protected readonly attempted = signal(false);
  protected readonly dirty = computed(() => FIELDS.some((field) => (this.draft()[field.key] ?? '') !== (this.saved()[field.key] ?? '')));
  protected readonly canEditAny = computed(() => FIELDS.some((field) => this.mayEdit(field.key)));
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('navigation.items.approvals'), path: '/approvals' },
    { label: this.i18n.t('ux.approvalLimits.title') },
  ]);

  constructor() {
    inject(UnsavedChanges).track(() => this.hasUnsavedChanges());
    effect(() => {
      const values = this.data.value();
      if (!values) return;
      const text = Object.fromEntries(FIELDS.map((field) => [field.key, values[field.key] === undefined || values[field.key] === null ? '' : String(values[field.key])]));
      this.saved.set(text);
      this.draft.set({ ...text });
    });
  }

  hasUnsavedChanges(): boolean {
    return this.dirty() && !this.actions.busy();
  }

  /** Same split the API applies per key; fails closed until the server says which keys are policy. */
  protected mayEdit(key: string): boolean {
    if (!this.meta.hasValue()) return false;
    return this.meta.value().policyKeys.includes(key) ? this.auth.can('settings.manage_policy') : this.auth.can('settings.manage');
  }

  /** Approval numbers are never negative: the minus sign cannot be typed. */
  protected blockSign(event: KeyboardEvent): void {
    if (event.key === '-' || event.key === '+') event.preventDefault();
  }

  protected set(key: string, value: string): void {
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  protected reset(): void {
    this.draft.set({ ...this.saved() });
    this.attempted.set(false);
    this.actions.error.set(null);
  }

  protected fieldId(field: LimitField): string {
    return `limit-${field.key.replace(/\./g, '-')}`;
  }

  protected label(field: LimitField): string {
    const key = `admin.settings.keys.${field.key.replace(/\./g, '_')}`;
    return this.i18n.has(key) ? this.i18n.t(key) : field.key;
  }

  protected help(field: LimitField): string {
    const key = `ux.approvalLimits.help.${field.key.replace(/\./g, '_')}`;
    return this.i18n.has(key) ? this.i18n.t(key) : '';
  }

  protected rangeParams(field: LimitField): Record<string, number> {
    return { min: field.min, max: field.max ?? 0 };
  }

  /** The client copy of the API's range rule (`SETTING_RANGES`) and the discount ordering. */
  protected error(field: LimitField): string | null {
    const text = (this.draft()[field.key] ?? '').trim();
    const changed = text !== (this.saved()[field.key] ?? '');
    if (!changed && !this.attempted()) return null;
    // A pasted negative is named as such, not as "not a number".
    if (/^[-−]/.test(text)) return 'server.validation.notNegative';
    const value = parse(text);
    if (value === null) return 'ux.approvalLimits.errors.number';
    if (field.integer && !Number.isInteger(value)) return 'ux.approvalLimits.errors.integer';
    if (value < field.min || (field.max !== undefined && value > field.max)) return field.max !== undefined ? 'ux.approvalLimits.errors.range' : 'ux.approvalLimits.errors.min';
    if (field.key === 'approval.discount.salesManagerMaxPct') {
      const cfo = parse((this.draft()['approval.discount.cfoMaxPct'] ?? '').trim());
      if (cfo !== null && value > cfo) return 'server.validation.discountLimitsOrder';
    }
    return null;
  }

  protected save(event: Event): void {
    event.preventDefault();
    this.attempted.set(true);
    const changed = FIELDS.filter((field) => this.mayEdit(field.key) && (this.draft()[field.key] ?? '').trim() !== (this.saved()[field.key] ?? ''));
    if (FIELDS.some((field) => this.error(field))) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    if (!changed.length || this.actions.busy()) return;
    const values = Object.fromEntries(changed.map((field) => [field.key, parse((this.draft()[field.key] ?? '').trim())]));
    void this.actions.run(this.api.patch<Record<string, unknown>>('settings', { values }), 'ux.approvalLimits.saved', () => {
      this.attempted.set(false);
      // Re-read what the server stored (it is the source of truth for the matrix).
      this.data.reload();
    });
  }
}

/** A plain non-negative decimal (Arabic-Indic digits and thousands separators accepted), or null. */
function parse(text: string): number | null {
  const ascii = text
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    // Thousands separators ("5,000,000") are dropped; "٫" is the Arabic decimal point.
    .replace(/[,٬\s]/g, '')
    .replace('٫', '.');
  if (!/^\d+(\.\d+)?$/.test(ascii)) return null;
  const value = Number(ascii);
  return Number.isFinite(value) ? value : null;
}

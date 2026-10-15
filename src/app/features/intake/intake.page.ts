import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../core/reference/reference-data.service';
import { CompletenessPanelComponent } from '../../shared/crm/completeness-panel/completeness-panel.component';
import { EnumLabelPipe } from '../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { IntakeApi, type IntakeFieldDef, type IntakeFieldValue } from './intake-api.service';
import { DetailSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';

interface Draft {
  value: unknown;
  origin: 'customer' | 'sales_observed';
}

/**
 * TIN-01..07 Technical Intake Form: sections and fields come from the
 * opportunity's solution type (admin-configurable), every value carries its
 * data origin, partial saves are allowed, and engineers verify fields without
 * losing the original value (shown in the history).
 */
@Component({
  selector: 'app-intake-page',
  imports: [DetailSkeletonComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, CompletenessPanelComponent, AlertComponent, BadgeComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './intake.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class IntakePage {
  private readonly api = inject(IntakeApi);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  /** Opportunity id. */
  readonly id = input.required<string>();

  protected readonly view = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get(params) });
  protected readonly drafts = signal<Record<string, Draft>>({});
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly openHistory = signal<string | null>(null);
  protected readonly verifying = signal<string | null>(null);
  protected readonly verifyValue = signal('');
  protected readonly verifyNote = signal('');

  protected readonly canEdit = computed(() => this.auth.can('intake.edit'));
  protected readonly canVerify = computed(() => this.auth.can('intake.verify'));
  protected readonly dirtyCount = computed(() => Object.keys(this.drafts()).length);
  protected readonly dirty = computed(() => this.dirtyCount() > 0);

  constructor() {
    void this.reference.load();
    effect(() => {
      if (this.view.value()) this.drafts.set({});
    });
  }

  protected fieldsOf(section: string): IntakeFieldDef[] {
    return (this.view.value()?.schema ?? []).filter((field) => field.section === section);
  }

  protected locked(key: string): boolean {
    return this.view.value()?.locked.includes(key) ?? false;
  }

  protected stored(key: string): IntakeFieldValue | undefined {
    const [section, field] = key.split('.');
    return this.view.value()?.sections[section]?.[field];
  }

  protected text(key: string): string {
    const draft = this.drafts()[key];
    const value = draft ? draft.value : this.stored(key)?.value;
    return value === null || value === undefined ? '' : String(value);
  }

  protected originOf(key: string): string {
    const draft = this.drafts()[key];
    const stored = this.stored(key)?.origin;
    return draft?.origin ?? (stored === 'sales_observed' ? 'sales_observed' : 'customer');
  }

  protected set(section: string, field: IntakeFieldDef, raw: string): void {
    const key = `${section}.${field.id}`;
    const value = raw === '' ? null : field.type === 'number' ? Number(raw) : field.type === 'boolean' ? raw === 'true' : raw;
    this.drafts.update((all) => ({ ...all, [key]: { value, origin: (all[key]?.origin ?? this.originOf(key)) as Draft['origin'] } }));
  }

  protected setOrigin(section: string, field: IntakeFieldDef, origin: Draft['origin']): void {
    const key = `${section}.${field.id}`;
    const current = this.drafts()[key];
    this.drafts.update((all) => ({ ...all, [key]: { value: current ? current.value : (this.stored(key)?.value ?? null), origin } }));
  }

  protected toggleHistory(key: string): void {
    this.openHistory.set(this.openHistory() === key ? null : key);
  }

  protected startVerify(section: string, field: IntakeFieldDef): void {
    const key = `${section}.${field.id}`;
    this.verifying.set(key);
    this.verifyValue.set(this.text(key));
    this.verifyNote.set('');
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const sections: Record<string, Record<string, { value: unknown; origin?: string }>> = {};
    for (const [key, draft] of Object.entries(this.drafts())) {
      const [section, field] = key.split('.');
      (sections[section] ??= {})[field] = { value: draft.value, origin: draft.origin };
    }
    await this.run(this.api.save(this.id(), sections), 'intake.saved');
  }

  protected async verify(section: string, field: IntakeFieldDef): Promise<void> {
    const raw = this.verifyValue();
    const value = raw === '' ? null : field.type === 'number' ? Number(raw) : field.type === 'boolean' ? raw === 'true' : raw;
    await this.run(this.api.verify(this.id(), { section, fieldId: field.id, value, note: this.verifyNote().trim() || undefined }), 'intake.verified');
    this.verifying.set(null);
  }

  protected sectionLabel(section: string): string {
    const key = `intake.sections.${section}`;
    return this.i18n.has(key) ? this.i18n.t(key) : section;
  }

  protected optionLabel(option: string): string {
    const key = `intake.options.${option}`;
    return this.i18n.has(key) ? this.i18n.t(key) : option;
  }

  protected display(value: unknown): string {
    if (value === true) return this.i18n.t('crm.common.yes');
    if (value === false) return this.i18n.t('crm.common.no');
    return value === null || value === undefined || value === '' ? '—' : this.optionLabel(String(value));
  }

  private async run(action: ReturnType<IntakeApi['save']>, successKey: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      await firstValueFrom(action);
      this.message.set(this.i18n.t(successKey));
      this.view.reload();
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
    } finally {
      this.busy.set(false);
    }
  }
}

import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { ApiService } from '../../../core/api/api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { LocalPager } from '../../../shared/crm/pagination/local-pager';
import { PagerComponent } from '../../../shared/crm/pagination/pager.component';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';

type Section = 'goals' | 'electricity' | 'site' | 'storage' | 'pumping' | 'constraints';

interface FieldDef {
  id: string;
  section: Section;
  type: 'text' | 'number' | 'boolean' | 'select';
  labelAr: string;
  labelEn: string;
  required: boolean;
  options?: string[];
}

interface FormMeta {
  intakeSections: Section[];
  hiddenIntakeFields: string[];
  requiredIntakeFields: string[];
  optionalIntakeFields: string[];
  customIntakeFields: FieldDef[];
}

interface Catalogue {
  sections: Section[];
  defaults: FieldDef[];
  forms: Array<{ code: string; nameAr: string; nameEn: string; isActive: boolean; meta: FormMeta }>;
}

type Mode = 'hidden' | 'required' | 'optional' | 'default';

/**
 * TIN-07 technical-intake form per solution type: which sections apply,
 * which default fields are hidden / required / optional, and custom fields
 * added by an administrator. The intake page, validation and completeness
 * all follow this definition.
 */
@Component({
  selector: 'app-intake-forms-page',
  imports: [TranslatePipe, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS, PagerComponent, CreateIconComponent],
  templateUrl: './intake-forms.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class IntakeFormsPage {
  private readonly api = inject(ApiService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  protected readonly data = rxResource({ stream: () => this.api.get<Catalogue>('technical-intakes/forms') });
  protected readonly selected = signal('');
  protected readonly meta = signal<FormMeta | null>(null);
  protected readonly fieldsInSections = computed(() => {
    const m = this.meta();
    return m ? (this.data.value()?.defaults ?? []).filter((f) => m.intakeSections.includes(f.section)) : [];
  });
  /** The fields of the chosen form, paged in memory. */
  protected readonly fieldsPager = new LocalPager(() => this.fieldsInSections());

  constructor() {
    effect(() => {
      const forms = this.data.value()?.forms;
      if (forms?.length && !this.selected()) this.selected.set(forms[0].code);
    });
    effect(() => {
      const form = this.data.value()?.forms.find((f) => f.code === this.selected());
      this.meta.set(form ? structuredClone(form.meta) : null);
    });
  }

  private key(field: FieldDef): string {
    return `${field.section}.${field.id}`;
  }

  protected mode(field: FieldDef): Mode {
    const m = this.meta();
    const key = this.key(field);
    if (!m) return 'default';
    if (m.hiddenIntakeFields.includes(key)) return 'hidden';
    if (m.requiredIntakeFields.includes(key)) return 'required';
    if (m.optionalIntakeFields.includes(key)) return 'optional';
    return 'default';
  }

  protected setMode(field: FieldDef, mode: Mode): void {
    const key = this.key(field);
    this.meta.update((m) => {
      if (!m) return m;
      const without = (list: string[]) => list.filter((k) => k !== key);
      return {
        ...m,
        hiddenIntakeFields: mode === 'hidden' ? [...without(m.hiddenIntakeFields), key] : without(m.hiddenIntakeFields),
        requiredIntakeFields: mode === 'required' ? [...without(m.requiredIntakeFields), key] : without(m.requiredIntakeFields),
        optionalIntakeFields: mode === 'optional' ? [...without(m.optionalIntakeFields), key] : without(m.optionalIntakeFields),
      };
    });
  }

  protected toggleSection(section: Section, on: boolean): void {
    this.meta.update((m) => (m ? { ...m, intakeSections: on ? [...m.intakeSections, section] : m.intakeSections.filter((s) => s !== section) } : m));
  }

  protected addCustom(): void {
    this.meta.update((m) => (m ? { ...m, customIntakeFields: [...m.customIntakeFields, { id: '', section: m.intakeSections[0] ?? 'site', type: 'text', labelAr: '', labelEn: '', required: false }] } : m));
  }

  protected setCustom(index: number, key: keyof FieldDef, value: unknown): void {
    const next = key === 'options' ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : value;
    this.meta.update((m) => (m ? { ...m, customIntakeFields: m.customIntakeFields.map((f, i) => (i === index ? { ...f, [key]: next } : f)) } : m));
  }

  protected removeCustom(index: number): void {
    this.meta.update((m) => (m ? { ...m, customIntakeFields: m.customIntakeFields.filter((_, i) => i !== index) } : m));
  }

  protected save(): void {
    const m = this.meta();
    if (!m) return;
    void this.actions.run(this.api.put(`technical-intakes/forms/${this.selected()}`, m), 'admin.saved', () => this.data.reload());
  }
}

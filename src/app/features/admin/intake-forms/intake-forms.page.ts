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
  imports: [TranslatePipe, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'admin.intakeForms.title' | t" [subtitle]="'admin.intakeForms.subtitle' | t" class="!mb-0" />
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    @if (actions.error(); as text) {
      <app-alert variant="destructive">{{ text }}</app-alert>
    }
    <div class="flex flex-wrap items-end gap-3">
      <div class="min-w-64">
        <label appLabel for="if-type">{{ 'crm.opportunities.fields.solutionTypeCode' | t }}</label>
        <app-select>
          <select appSelect id="if-type" [value]="selected()" (change)="selected.set($any($event.target).value)">
            @for (form of data.value()?.forms ?? []; track form.code) {
              <option [value]="form.code">{{ i18n.pick(form.nameAr, form.nameEn) }}</option>
            }
          </select>
        </app-select>
      </div>
      <button type="button" appButton [disabled]="actions.busy() || !meta()" (click)="save()">{{ 'crm.common.save' | t }}</button>
    </div>

    @if (meta(); as m) {
      <section appCard aria-labelledby="if-sections">
        <div appCardHeader><h2 appCardTitle id="if-sections">{{ 'admin.intakeForms.sections' | t }}</h2></div>
        <div appCardContent class="flex flex-wrap gap-4">
          @for (section of data.value()?.sections ?? []; track section) {
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="m.intakeSections.includes(section)" (change)="toggleSection(section, $any($event.target).checked)" /> {{ 'intake.sections.' + section | t }}</label>
          }
        </div>
      </section>

      <app-table-wrapper [label]="'admin.intakeForms.fields' | t">
        <table appTable>
          <thead appTableHeader>
            <tr appTableRow>
              <th appTableHead>{{ 'admin.intakeForms.section' | t }}</th>
              <th appTableHead>{{ 'admin.intakeForms.field' | t }}</th>
              <th appTableHead>{{ 'admin.intakeForms.mode' | t }}</th>
            </tr>
          </thead>
          <tbody appTableBody>
            @for (field of fieldsInSections(); track field.section + field.id) {
              <tr appTableRow>
                <td appTableCell class="text-xs">{{ 'intake.sections.' + field.section | t }}</td>
                <td appTableCell>{{ i18n.pick(field.labelAr, field.labelEn) }} <span class="text-xs text-muted-foreground" dir="ltr">({{ field.type }})</span></td>
                <td appTableCell>
                  <app-select>
                    <select appSelect [attr.aria-label]="i18n.pick(field.labelAr, field.labelEn)" [value]="mode(field)" (change)="setMode(field, $any($event.target).value)">
                      <option value="default">{{ (field.required ? 'admin.intakeForms.defaultRequired' : 'admin.intakeForms.defaultOptional') | t }}</option>
                      <option value="required">{{ 'admin.intakeForms.required' | t }}</option>
                      <option value="optional">{{ 'admin.intakeForms.optional' | t }}</option>
                      <option value="hidden">{{ 'admin.intakeForms.hidden' | t }}</option>
                    </select>
                  </app-select>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </app-table-wrapper>

      <section appCard aria-labelledby="if-custom">
        <div appCardHeader>
          <h2 appCardTitle id="if-custom">{{ 'admin.intakeForms.custom' | t }}</h2>
        </div>
        <div appCardContent class="flex flex-col gap-3">
          @for (field of m.customIntakeFields; track $index; let index = $index) {
            <div class="grid items-end gap-2 sm:grid-cols-7">
              <input appInput dir="ltr" [attr.aria-label]="'admin.code' | t" [placeholder]="'admin.code' | t" [value]="field.id" (input)="setCustom(index, 'id', $any($event.target).value.trim())" />
              <app-select>
                <select appSelect [attr.aria-label]="'admin.intakeForms.section' | t" [value]="field.section" (change)="setCustom(index, 'section', $any($event.target).value)">
                  @for (section of data.value()?.sections ?? []; track section) {
                    <option [value]="section">{{ 'intake.sections.' + section | t }}</option>
                  }
                </select>
              </app-select>
              <app-select>
                <select appSelect [attr.aria-label]="'admin.intakeForms.type' | t" [value]="field.type" (change)="setCustom(index, 'type', $any($event.target).value)">
                  @for (type of ['text', 'number', 'boolean', 'select']; track type) {
                    <option [value]="type">{{ 'admin.intakeForms.types.' + type | t }}</option>
                  }
                </select>
              </app-select>
              <input appInput dir="rtl" [attr.aria-label]="'admin.nameAr' | t" [placeholder]="'admin.nameAr' | t" [value]="field.labelAr" (input)="setCustom(index, 'labelAr', $any($event.target).value)" />
              <input appInput dir="ltr" [attr.aria-label]="'admin.nameEn' | t" [placeholder]="'admin.nameEn' | t" [value]="field.labelEn" (input)="setCustom(index, 'labelEn', $any($event.target).value)" />
              @if (field.type === 'select') {
                <input appInput dir="ltr" [attr.aria-label]="'admin.intakeForms.options' | t" [placeholder]="'admin.intakeForms.options' | t" [value]="(field.options ?? []).join(',')" (change)="setCustom(index, 'options', $any($event.target).value)" />
              } @else {
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="field.required" (change)="setCustom(index, 'required', $any($event.target).checked)" /> {{ 'admin.intakeForms.required' | t }}</label>
              }
              <button type="button" appButton variant="ghost" size="sm" (click)="removeCustom(index)">{{ 'crm.common.delete' | t }}</button>
            </div>
          }
          <button type="button" appButton variant="outline" size="sm" class="self-start" (click)="addCustom()">{{ 'admin.intakeForms.addField' | t }}</button>
        </div>
      </section>
    }
  `,
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

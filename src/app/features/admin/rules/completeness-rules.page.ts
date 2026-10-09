import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { TabsComponent } from '../../../shared/ui/tabs/tabs.component';
import { ActionRunner } from '../../../shared/utils/action-runner';

interface Rule {
  id: string;
  section: string;
  level: 'save' | 'gate' | 'recommended';
  gate: string | null;
  responsibleRole: string;
  field: string | null;
  documentCategory: string | null;
  active: boolean;
  isCustom: boolean;
  overridden: boolean;
}

interface EntityRules {
  entity: string;
  rules: Rule[];
}

const ROLES = ['sales_representative', 'sales_manager', 'telesales', 'marketing', 'project_manager', 'technical_lead', 'technical_proposal_engineer', 'financial_proposal_manager', 'operations', 'system_administrator'];

/**
 * CPL-09 completeness rules per record type: whether each item is required to
 * save, required at a gate, or only recommended; who is responsible for it;
 * switch it off; or add a custom field / document rule.
 */
@Component({
  selector: 'app-completeness-rules-page',
  imports: [TranslatePipe, EnumLabelPipe, AlertComponent, BadgeComponent, ButtonDirective, PageHeaderComponent, TabsComponent, ...CARD_IMPORTS, ...TABLE_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-page-header [heading]="'admin.rules.title' | t" [subtitle]="'admin.rules.subtitle' | t" class="!mb-0" />
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    @if (actions.error(); as text) {
      <app-alert variant="destructive">{{ text }}</app-alert>
    }
    <app-tabs [tabs]="tabs()" [(active)]="entity" [label]="'admin.rules.title' | t" />

    <app-table-wrapper [label]="'admin.rules.title' | t" [attr.aria-busy]="data.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'admin.rules.item' | t }}</th>
            <th appTableHead>{{ 'admin.rules.level' | t }}</th>
            <th appTableHead>{{ 'admin.rules.gate' | t }}</th>
            <th appTableHead>{{ 'admin.rules.responsible' | t }}</th>
            <th appTableHead>{{ 'admin.active' | t }}</th>
            <th appTableHead><span class="sr-only">{{ 'admin.actions' | t }}</span></th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (rule of rules(); track rule.id) {
            <tr appTableRow>
              <td appTableCell>
                <span class="font-medium">{{ label(rule) }}</span>
                <span class="block text-xs text-muted-foreground" dir="ltr">{{ rule.field || rule.documentCategory || rule.id }}</span>
                @if (rule.overridden) {
                  <app-badge tone="warning">{{ 'admin.rules.changed' | t }}</app-badge>
                }
                @if (rule.isCustom) {
                  <app-badge tone="info">{{ 'admin.rules.custom' | t }}</app-badge>
                }
              </td>
              <td appTableCell>
                <app-select>
                  <select appSelect [attr.aria-label]="'admin.rules.level' | t" [disabled]="!canManage() || rule.level === 'save'" [value]="draft(rule).level" (change)="patch(rule, 'level', $any($event.target).value)">
                    @for (level of levels; track level) {
                      <option [value]="level">{{ level | enum: 'completenessLevel' }}</option>
                    }
                  </select>
                </app-select>
              </td>
              <td appTableCell>
                @if (draft(rule).level === 'gate') {
                  <input appInput class="w-36" dir="ltr" [attr.aria-label]="'admin.rules.gate' | t" [disabled]="!canManage()" [value]="draft(rule).gate ?? ''" (input)="patch(rule, 'gate', $any($event.target).value)" />
                } @else {
                  —
                }
              </td>
              <td appTableCell>
                <app-select>
                  <select appSelect [attr.aria-label]="'admin.rules.responsible' | t" [disabled]="!canManage()" [value]="draft(rule).responsibleRole" (change)="patch(rule, 'responsibleRole', $any($event.target).value)">
                    @for (role of roles; track role) {
                      <option [value]="role">{{ role | enum: 'roleCode' }}</option>
                    }
                  </select>
                </app-select>
              </td>
              <td appTableCell><input type="checkbox" [attr.aria-label]="'admin.active' | t" [disabled]="!canManage() || rule.level === 'save'" [checked]="draft(rule).active" (change)="patch(rule, 'active', $any($event.target).checked)" /></td>
              <td appTableCell>
                @if (canManage()) {
                  <div class="flex gap-1">
                    <button type="button" appButton variant="outline" size="sm" [disabled]="actions.busy() || !edits()[rule.id]" (click)="save(rule)">{{ 'crm.common.save' | t }}</button>
                    @if (rule.overridden || rule.isCustom) {
                      <button type="button" appButton variant="ghost" size="sm" [disabled]="actions.busy()" (click)="reset(rule)">{{ (rule.isCustom ? 'crm.common.delete' : 'admin.rules.reset') | t }}</button>
                    }
                  </div>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </app-table-wrapper>

    @if (canManage()) {
      <form appCard (submit)="addCustom($event)" aria-labelledby="rules-custom">
        <div appCardHeader>
          <h2 appCardTitle id="rules-custom">{{ 'admin.rules.addCustom' | t }}</h2>
          <p appCardDescription>{{ 'admin.rules.customHint' | t }}</p>
        </div>
        <div appCardContent class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label appLabel for="cr-id" required>{{ 'admin.code' | t }}</label>
            <input appInput id="cr-id" dir="ltr" [value]="custom().id" (input)="setCustom('id', $any($event.target).value.trim())" />
          </div>
          <div>
            <label appLabel for="cr-field">{{ 'admin.rules.field' | t }}</label>
            <input appInput id="cr-field" dir="ltr" placeholder="e.g. website" [value]="custom().field" (input)="setCustom('field', $any($event.target).value.trim())" />
          </div>
          <div>
            <label appLabel for="cr-doc">{{ 'admin.rules.document' | t }}</label>
            <app-select>
              <select appSelect id="cr-doc" [value]="custom().documentCategory" (change)="setCustom('documentCategory', $any($event.target).value)">
                <option value="">—</option>
                @for (option of reference.options('document_category'); track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </app-select>
          </div>
          <div>
            <label appLabel for="cr-level">{{ 'admin.rules.level' | t }}</label>
            <app-select>
              <select appSelect id="cr-level" [value]="custom().level" (change)="setCustom('level', $any($event.target).value)">
                <option value="recommended">{{ 'recommended' | enum: 'completenessLevel' }}</option>
                <option value="gate">{{ 'gate' | enum: 'completenessLevel' }}</option>
              </select>
            </app-select>
          </div>
          @if (custom().level === 'gate') {
            <div>
              <label appLabel for="cr-gate" required>{{ 'admin.rules.gate' | t }}</label>
              <input appInput id="cr-gate" dir="ltr" [value]="custom().gate" (input)="setCustom('gate', $any($event.target).value.trim())" />
            </div>
          }
          <div>
            <label appLabel for="cr-role">{{ 'admin.rules.responsible' | t }}</label>
            <app-select>
              <select appSelect id="cr-role" [value]="custom().responsibleRole" (change)="setCustom('responsibleRole', $any($event.target).value)">
                @for (role of roles; track role) {
                  <option [value]="role">{{ role | enum: 'roleCode' }}</option>
                }
              </select>
            </app-select>
          </div>
          <div class="flex items-end">
            <button type="submit" appButton [disabled]="actions.busy() || !customValid()">{{ 'admin.rules.add' | t }}</button>
          </div>
        </div>
      </form>
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class CompletenessRulesPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly levels = ['save', 'gate', 'recommended'];
  protected readonly roles = ROLES;

  protected readonly data = rxResource({ stream: () => this.api.get<{ entities: EntityRules[] }>('completeness/rules').pipe(map((b) => b.entities)) });
  protected readonly entity = signal('customer');
  protected readonly edits = signal<Record<string, Partial<Rule>>>({});
  protected readonly canManage = computed(() => this.auth.can('settings.manage'));
  protected readonly tabs = computed(() => (this.data.value() ?? []).map((e) => ({ id: e.entity, label: this.i18n.t(`enums.completenessEntity.${e.entity}`), count: e.rules.length })));
  protected readonly rules = computed(() => this.data.value()?.find((e) => e.entity === this.entity())?.rules ?? []);
  protected readonly custom = signal({ id: '', field: '', documentCategory: '', level: 'recommended', gate: '', responsibleRole: 'sales_representative' });
  protected readonly customValid = computed(() => {
    const c = this.custom();
    return /^[a-z][a-z0-9_]{1,60}$/i.test(c.id) && (!!c.field || !!c.documentCategory) && (c.level !== 'gate' || !!c.gate);
  });

  constructor() {
    void this.reference.load();
    effect(() => {
      this.entity();
      this.edits.set({});
    });
  }

  protected label(rule: Rule): string {
    const key = `completeness.items.${this.entity()}.${rule.id}`;
    return this.i18n.has(key) ? this.i18n.t(key) : rule.field || rule.documentCategory || rule.id;
  }

  protected draft(rule: Rule): Rule {
    return { ...rule, ...(this.edits()[rule.id] ?? {}) } as Rule;
  }

  protected patch(rule: Rule, key: keyof Rule, value: unknown): void {
    this.edits.update((e) => ({ ...e, [rule.id]: { ...(e[rule.id] ?? {}), [key]: value } }));
  }

  protected save(rule: Rule): void {
    const d = this.draft(rule);
    const body = { active: d.active, level: d.level, gate: d.level === 'gate' ? d.gate || undefined : undefined, responsibleRole: d.responsibleRole };
    void this.actions.run(this.api.put<{ entities: EntityRules[] }>(`completeness/rules/${this.entity()}/${rule.id}`, body), 'admin.saved', (result) => {
      this.data.set(result.entities);
      this.edits.update((e) => {
        const next = { ...e };
        delete next[rule.id];
        return next;
      });
    });
  }

  protected reset(rule: Rule): void {
    void this.actions.run(this.api.delete<{ entities: EntityRules[] }>(`completeness/rules/${this.entity()}/${rule.id}`), 'admin.saved', (result) => this.data.set(result.entities));
  }

  protected setCustom(key: 'id' | 'field' | 'documentCategory' | 'level' | 'gate' | 'responsibleRole', value: string): void {
    this.custom.update((c) => ({ ...c, [key]: value }));
  }

  protected addCustom(event: Event): void {
    event.preventDefault();
    const c = this.custom();
    const body = { active: true, level: c.level, gate: c.level === 'gate' ? c.gate : undefined, responsibleRole: c.responsibleRole, field: c.field || undefined, documentCategory: c.documentCategory || undefined, section: 'custom' };
    void this.actions.run(this.api.put<{ entities: EntityRules[] }>(`completeness/rules/${this.entity()}/${c.id}`, body), 'admin.saved', (result) => {
      this.data.set(result.entities);
      this.custom.set({ id: '', field: '', documentCategory: '', level: 'recommended', gate: '', responsibleRole: 'sales_representative' });
    });
  }
}

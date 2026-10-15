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
  templateUrl: './completeness-rules.page.html',
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

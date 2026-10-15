import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';

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

type Value = number | string | boolean | string[] | Record<string, unknown>;

interface Gate {
  stage: string;
  code: string;
  defaultSeverity: 'hard' | 'soft';
  severity: 'hard' | 'soft' | 'off';
  locked: boolean;
}

/** Fixed choices for string settings (anything else is free text). */
const CHOICES: Record<string, string[]> = {
  'lead.distribution.mode': ['instant', 'batch', 'manual'],
  'lead.distribution.batchSchedule': ['daily', 'weekly', 'monthly'],
  'opportunity.nextActionMode': ['block', 'warn'],
  'financialProposal.preparerRole': ['project_manager', 'financial_proposal_manager'],
  'approval.cpRelease.defaultRole': ['financial_proposal_manager', 'project_manager', 'ceo'],
  'finance.currency': ['EGP', 'USD', 'EUR'],
};

/** Keys edited on their own screens. */
const HIDDEN = new Set(['gates.severityOverrides', 'automation.disabled']);

/**
 * ADM-03 / §21 settings: system configuration (SLAs, distribution, sessions,
 * MFA, notifications…) edited by the platform administrator, and business
 * policy (approval thresholds, pricing, financial rules, stage-gate
 * severities §7.6) edited by the CEO / CFO. Each key is editable only with its
 * own permission; the API enforces the same split. Every change is audited.
 */
@Component({
  selector: 'app-settings-admin-page',
  imports: [TranslatePipe, EnumLabelPipe, AlertComponent, BadgeComponent, ButtonDirective, PageHeaderComponent, TabsComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS],
  templateUrl: './settings-admin.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class SettingsAdminPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly choices = CHOICES;

  protected readonly data = rxResource({ stream: () => this.api.get<Record<string, Value>>('settings') });
  protected readonly gates = rxResource({ params: () => this.auth.canAny(['settings.view', 'settings.manage', 'settings.manage_policy']), stream: ({ params }) => (params ? this.api.get<Gate[]>('opportunities/gates/catalogue') : of([] as Gate[])) });
  /** Which keys are business policy (approval limits, pricing, financial rules) — decided by the server. */
  protected readonly meta = rxResource({ stream: () => this.api.get<{ policyKeys: string[]; securityKeys?: string[] }>('settings/meta') });
  protected readonly canManage = computed(() => this.auth.can('settings.manage'));
  protected readonly canManagePolicy = computed(() => this.auth.can('settings.manage_policy'));
  private readonly policyKeys = computed(() => new Set(this.meta.value()?.policyKeys ?? []));
  /** Sessions, sign-in, MFA, password reset: the System Administrator's alone (`security.manage_settings`). */
  private readonly securityKeys = computed(() => new Set(this.meta.value()?.securityKeys ?? []));
  protected readonly canManageSecurity = computed(() => this.auth.can('security.manage_settings'));
  protected readonly draft = signal<Record<string, Value>>({});
  protected readonly changed = signal<Set<string>>(new Set());
  protected readonly dirty = computed(() => this.changed().size > 0);
  protected readonly group = signal('approval');
  protected readonly groups = computed(() => {
    const keys = Object.keys(this.data.value() ?? {}).filter((k) => !HIDDEN.has(k));
    return [...new Set(keys.map((k) => k.split('.')[0]))];
  });
  protected readonly tabs = computed(() => [...this.groups().map((g) => ({ id: g, label: this.groupLabel(g) })), { id: 'gates', label: this.i18n.t('admin.settings.gates') }]);

  constructor() {
    void this.reference.load();
    effect(() => {
      const values = this.data.value();
      if (values) {
        this.draft.set({ ...values });
        this.changed.set(new Set());
      }
    });
  }

  protected keysIn(group: string): string[] {
    return Object.keys(this.draft()).filter((k) => !HIDDEN.has(k) && k.split('.')[0] === group);
  }

  protected kind(key: string): 'boolean' | 'number' | 'choice' | 'list' | 'map' | 'text' {
    const value = this.draft()[key];
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'list';
    if (value && typeof value === 'object') return 'map';
    return CHOICES[key] ? 'choice' : 'text';
  }

  protected label(key: string): string {
    const k = `admin.settings.keys.${key.replace(/\./g, '_')}`;
    return this.i18n.has(k) ? this.i18n.t(k) : key;
  }

  protected groupLabel(group: string): string {
    const k = `admin.settings.groups.${group}`;
    return this.i18n.has(k) ? this.i18n.t(k) : group;
  }

  protected choiceLabel(choice: string): string {
    const k = `admin.settings.choices.${choice}`;
    if (this.i18n.has(k)) return this.i18n.t(k);
    const role = `enums.roleCode.${choice}`;
    return this.i18n.has(role) ? this.i18n.t(role) : choice;
  }

  /** The number field whose last entry was refused (a negative or non-numeric value). */
  protected readonly rejected = signal<string | null>(null);

  /** Settings are never negative: the minus sign (and `+`, exponents) cannot even be typed. */
  protected blockSign(event: KeyboardEvent): void {
    if (['-', '+', 'e', 'E'].includes(event.key)) event.preventDefault();
  }

  /**
   * Takes a number of 0 or more. Anything else — a pasted "-5", text — is
   * refused: the field goes back to its last value and says why. (The API
   * refuses negatives too, `validation.notNegative`.)
   */
  protected setNumber(key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value === '' ? 0 : Number(input.value);
    if (input.validity.badInput || !Number.isFinite(value) || value < 0) {
      input.value = String(this.draft()[key] ?? 0);
      this.rejected.set(key);
      return;
    }
    if (this.rejected() === key) this.rejected.set(null);
    this.set(key, value);
  }

  protected list(value: string): string[] {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }

  protected listText(key: string): string {
    return ((this.draft()[key] as string[]) ?? []).join(', ');
  }

  protected json(key: string): string {
    return JSON.stringify(this.draft()[key] ?? {}, null, 1);
  }

  protected setJson(key: string, text: string): void {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
      if (hasNegative(parsed)) {
        this.actions.error.set(this.i18n.t('ux.settings.negativeInMap', { key: this.label(key) }));
        return;
      }
      this.set(key, parsed);
    } catch {
      this.actions.error.set(this.i18n.t('admin.settings.invalidJson', { key }));
    }
  }

  protected isPolicy(key: string): boolean {
    return this.policyKeys().has(key);
  }

  protected isSecurity(key: string): boolean {
    return this.securityKeys().has(key);
  }

  /**
   * The same split the API applies per key: security keys need
   * `security.manage_settings` (System Administrator), business-policy keys
   * `settings.manage_policy` (administrator, CEO, CFO), every other key
   * `settings.manage` (administrator, CEO). Fails closed until the split is known.
   */
  protected mayEdit(key: string): boolean {
    if (!this.meta.hasValue()) return false;
    if (this.isSecurity(key)) return this.canManageSecurity();
    return this.isPolicy(key) ? this.canManagePolicy() : this.canManage();
  }

  protected set(key: string, value: Value): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
    this.changed.update((c) => new Set(c).add(key));
  }

  protected gateValue(gate: Gate): string {
    const overrides = (this.draft()['gates.severityOverrides'] ?? {}) as Record<string, string>;
    return overrides[`${gate.stage}.${gate.code}`] ?? overrides[gate.code] ?? gate.severity;
  }

  protected setGate(gate: Gate, severity: string): void {
    const overrides = { ...((this.draft()['gates.severityOverrides'] ?? {}) as Record<string, string>) };
    const key = `${gate.stage}.${gate.code}`;
    if (severity === gate.defaultSeverity) delete overrides[key];
    else overrides[key] = severity;
    this.set('gates.severityOverrides', overrides);
  }

  protected save(): void {
    const draft = this.draft();
    const values = Object.fromEntries([...this.changed()].map((key) => [key, draft[key]]));
    void this.actions.run(this.api.patch<Record<string, Value>>('settings', { values }), 'admin.saved', (after) => {
      this.data.set(after);
      this.gates.reload();
    });
  }
}

/** True when a map setting holds a negative (or non-finite) number anywhere. */
function hasNegative(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value) || value < 0;
  if (value && typeof value === 'object') return Object.values(value).some(hasNegative);
  return false;
}

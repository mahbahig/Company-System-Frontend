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
  template: `
    <app-page-header [heading]="'admin.settings.title' | t" [subtitle]="'admin.settings.subtitle' | t" class="!mb-0">
      @if (canManage() || canManagePolicy()) {
        <button type="button" appButton [disabled]="actions.busy() || !dirty()" (click)="save()">{{ 'admin.settings.save' | t }}</button>
      }
    </app-page-header>
    <p class="text-sm text-muted-foreground">{{ 'admin.settings.policyHint' | t }}</p>
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    @if (actions.error(); as text) {
      <app-alert variant="destructive">{{ text }}</app-alert>
    }
    <app-tabs [tabs]="tabs()" [(active)]="group" [label]="'admin.settings.title' | t" />

    @if (group() === 'gates') {
      <app-table-wrapper [label]="'admin.settings.gates' | t" [attr.aria-busy]="gates.isLoading()">
        <table appTable>
          <thead appTableHeader>
            <tr appTableRow>
              <th appTableHead>{{ 'admin.settings.stage' | t }}</th>
              <th appTableHead>{{ 'admin.settings.gate' | t }}</th>
              <th appTableHead>{{ 'admin.settings.default' | t }}</th>
              <th appTableHead>{{ 'admin.settings.effective' | t }}</th>
            </tr>
          </thead>
          <tbody appTableBody>
            @for (gate of gates.value() ?? []; track gate.stage + gate.code) {
              <tr appTableRow>
                <td appTableCell>{{ reference.label('pipeline_stage', gate.stage) }}</td>
                <td appTableCell>
                  {{ 'crm.opportunities.gates.' + gate.code | t }}
                  @if (gate.locked) {
                    <app-badge tone="info" class="ms-1">{{ 'admin.settings.locked' | t }}</app-badge>
                  }
                </td>
                <td appTableCell>{{ gate.defaultSeverity | enum: 'gateSeverity' }}</td>
                <td appTableCell>
                  <app-select>
                    <select appSelect [attr.aria-label]="'admin.settings.effective' | t" [disabled]="gate.locked || !mayEdit('gates.severityOverrides')" [value]="gateValue(gate)" (change)="setGate(gate, $any($event.target).value)">
                      @for (severity of ['hard', 'soft', 'off']; track severity) {
                        <option [value]="severity">{{ severity | enum: 'gateSeverity' }}</option>
                      }
                    </select>
                  </app-select>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </app-table-wrapper>
    } @else {
      <section appCard>
        <div appCardContent class="grid gap-5 sm:grid-cols-2">
          @for (key of keysIn(group()); track key) {
            <div>
              @switch (kind(key)) {
                @case ('boolean') {
                  <label class="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" [disabled]="!mayEdit(key)" [checked]="draft()[key]" (change)="set(key, $any($event.target).checked)" />
                    {{ label(key) }}
                  </label>
                }
                @case ('number') {
                  <label appLabel [for]="'s-' + key">{{ label(key) }}</label>
                  <input
                    appInput
                    type="number"
                    min="0"
                    step="any"
                    inputmode="decimal"
                    dir="ltr"
                    [id]="'s-' + key"
                    [disabled]="!mayEdit(key)"
                    [value]="draft()[key]"
                    (keydown)="blockSign($event)"
                    (input)="setNumber(key, $event)"
                    [attr.aria-invalid]="rejected() === key ? true : null"
                    [attr.aria-describedby]="rejected() === key ? 's-' + key + '-error' : null"
                  />
                  @if (rejected() === key) {
                    <p [id]="'s-' + key + '-error'" role="alert" class="mt-1 text-sm text-destructive">{{ 'server.validation.notNegative' | t }}</p>
                  }
                }
                @case ('choice') {
                  <label appLabel [for]="'s-' + key">{{ label(key) }}</label>
                  <app-select>
                    <select appSelect [id]="'s-' + key" [disabled]="!mayEdit(key)" [value]="draft()[key]" (change)="set(key, $any($event.target).value)">
                      @for (choice of choices[key]; track choice) {
                        <option [value]="choice">{{ choiceLabel(choice) }}</option>
                      }
                    </select>
                  </app-select>
                }
                @case ('list') {
                  <label appLabel [for]="'s-' + key">{{ label(key) }}</label>
                  <input appInput dir="ltr" [id]="'s-' + key" [disabled]="!mayEdit(key)" [value]="listText(key)" (change)="set(key, list($any($event.target).value))" />
                  <p class="mt-1 text-xs text-muted-foreground">{{ 'admin.users.commaSeparated' | t }}</p>
                }
                @case ('map') {
                  <label appLabel [for]="'s-' + key">{{ label(key) }}</label>
                  <textarea appTextarea rows="3" dir="ltr" class="font-mono text-xs" [id]="'s-' + key" [disabled]="!mayEdit(key)" [value]="json(key)" (change)="setJson(key, $any($event.target).value)"></textarea>
                }
                @default {
                  <label appLabel [for]="'s-' + key">{{ label(key) }}</label>
                  <input appInput dir="ltr" [id]="'s-' + key" [disabled]="!mayEdit(key)" [value]="draft()[key]" (input)="set(key, $any($event.target).value)" />
                }
              }
              @if (isPolicy(key)) {
                <app-badge tone="info" class="mt-1">{{ 'admin.settings.policyBadge' | t }}</app-badge>
              }
              @if (isSecurity(key)) {
                <app-badge tone="warning" class="mt-1">{{ 'ux.settings.securityBadge' | t }}</app-badge>
              }
              @if (mayEdit(key)) {
                <p class="mt-1 font-mono text-[10px] text-muted-foreground" dir="ltr">{{ key }}</p>
              }
            </div>
          }
        </div>
      </section>
    }
  `,
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

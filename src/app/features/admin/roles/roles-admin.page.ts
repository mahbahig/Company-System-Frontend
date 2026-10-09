import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { AdminApi, type Role } from '../admin-api.service';

type ScopeValue = '' | 'own' | 'team' | 'all';

/**
 * RBAC-01..03 roles and the permission matrix: for each permission, the
 * scope a role holds it with (own records, team, whole company) or not at all.
 * System roles can be edited but not renamed by code; changes are audited
 * and apply on the next request.
 */
@Component({
  selector: 'app-roles-admin-page',
  imports: [TranslatePipe, AlertComponent, BadgeComponent, ButtonDirective, DialogComponent, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'admin.roles.title' | t" [subtitle]="'admin.roles.subtitle' | t" class="!mb-0">
      <button type="button" appButton variant="outline" (click)="newOpen.set(true)">{{ 'admin.roles.new' | t }}</button>
    </app-page-header>
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    @if (actions.error(); as text) {
      <app-alert variant="destructive">{{ text }}</app-alert>
    }
    <div class="flex flex-wrap items-end gap-3">
      <div class="min-w-64">
        <label appLabel for="role-pick">{{ 'admin.roles.role' | t }}</label>
        <app-select>
          <select appSelect id="role-pick" [value]="selected()" (change)="selected.set($any($event.target).value)">
            @for (role of roles.value() ?? []; track role.code) {
              <option [value]="role.code">{{ i18n.pick(role.nameAr, role.nameEn) }}</option>
            }
          </select>
        </app-select>
      </div>
      @if (current(); as role) {
        @if (role.isSystem) {
          <app-badge tone="info">{{ 'admin.roles.system' | t }}</app-badge>
        }
        <label class="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" [checked]="activeDraft()" (change)="activeDraft.set($any($event.target).checked)" [disabled]="role.isSystem" /> {{ 'admin.active' | t }}</label>
        <div class="min-w-48">
          <label appLabel for="role-filter">{{ 'admin.roles.filter' | t }}</label>
          <input appInput id="role-filter" dir="ltr" [value]="filter()" (input)="filter.set($any($event.target).value)" />
        </div>
        <button type="button" appButton [disabled]="actions.busy() || !dirty()" (click)="save()">{{ 'admin.roles.save' | t }}</button>
      }
    </div>

    <app-table-wrapper [label]="'admin.roles.matrix' | t" [attr.aria-busy]="catalogue.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'admin.roles.module' | t }}</th>
            <th appTableHead>{{ 'admin.roles.permission' | t }}</th>
            <th appTableHead>{{ 'admin.roles.scope' | t }}</th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (p of visiblePermissions(); track p.code) {
            <tr appTableRow>
              <td appTableCell class="text-xs text-muted-foreground" dir="ltr">{{ p.module }}</td>
              <td appTableCell dir="ltr" class="font-mono text-xs">{{ p.code }}</td>
              <td appTableCell>
                <div class="flex flex-wrap gap-3 text-sm" role="radiogroup" [attr.aria-label]="p.code">
                  @for (scope of scopes; track scope) {
                    <label class="flex items-center gap-1">
                      <input type="radio" [name]="'scope-' + p.code" [checked]="(grants()[p.code] ?? '') === scope" (change)="setScope(p.code, scope)" />
                      {{ 'admin.roles.scopes.' + (scope || 'none') | t }}
                    </label>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </app-table-wrapper>

    <app-dialog [(open)]="newOpen" [heading]="'admin.roles.new' | t">
      <form class="grid gap-4 sm:grid-cols-2" (submit)="create($event)">
        <div>
          <label appLabel for="nr-code" required>{{ 'admin.code' | t }}</label>
          <input appInput id="nr-code" dir="ltr" [value]="newRole().code" (input)="setNew('code', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="nr-copy">{{ 'admin.roles.copyFrom' | t }}</label>
          <app-select>
            <select appSelect id="nr-copy" [value]="newRole().copyFrom" (change)="setNew('copyFrom', $any($event.target).value)">
              <option value="">—</option>
              @for (role of roles.value() ?? []; track role.code) {
                <option [value]="role.code">{{ i18n.pick(role.nameAr, role.nameEn) }}</option>
              }
            </select>
          </app-select>
        </div>
        <div>
          <label appLabel for="nr-ar" required>{{ 'admin.nameAr' | t }}</label>
          <input appInput id="nr-ar" dir="rtl" [value]="newRole().nameAr" (input)="setNew('nameAr', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="nr-en" required>{{ 'admin.nameEn' | t }}</label>
          <input appInput id="nr-en" dir="ltr" [value]="newRole().nameEn" (input)="setNew('nameEn', $any($event.target).value)" />
        </div>
        <button type="submit" appButton class="self-start" [disabled]="actions.busy() || !/^[a-z][a-z0-9_]{2,40}$/.test(newRole().code) || !newRole().nameAr || !newRole().nameEn">{{ 'crm.common.save' | t }}</button>
      </form>
    </app-dialog>
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class RolesAdminPage {
  private readonly api = inject(AdminApi);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly scopes: ScopeValue[] = ['', 'own', 'team', 'all'];

  protected readonly roles = rxResource({ stream: () => this.api.roles() });
  protected readonly catalogue = rxResource({ stream: () => this.api.permissionCatalogue() });
  protected readonly selected = signal('');
  protected readonly filter = signal('');
  protected readonly grants = signal<Record<string, ScopeValue>>({});
  protected readonly activeDraft = signal(true);
  protected readonly dirty = signal(false);
  protected readonly current = computed<Role | undefined>(() => this.roles.value()?.find((r) => r.code === this.selected()));
  protected readonly visiblePermissions = computed(() => {
    const f = this.filter().trim().toLowerCase();
    return (this.catalogue.value() ?? []).filter((p) => !f || p.code.includes(f));
  });

  protected readonly newOpen = signal(false);
  protected readonly newRole = signal({ code: '', nameAr: '', nameEn: '', copyFrom: '' });

  constructor() {
    effect(() => {
      const roles = this.roles.value();
      if (roles?.length && !this.selected()) this.selected.set(roles[0].code);
    });
    effect(() => {
      const role = this.current();
      if (!role) return;
      this.grants.set(Object.fromEntries(role.permissions.map((g) => [g.code, g.scope])));
      this.activeDraft.set(role.isActive);
      this.dirty.set(false);
    });
  }

  protected setScope(code: string, scope: ScopeValue): void {
    this.grants.update((g) => ({ ...g, [code]: scope }));
    this.dirty.set(true);
  }

  protected save(): void {
    const role = this.current();
    if (!role) return;
    const permissions = Object.entries(this.grants())
      .filter(([, scope]) => !!scope)
      .map(([code, scope]) => ({ code, scope }));
    void this.actions.run(this.api.updateRole(role.code, { permissions, isActive: this.activeDraft() }), 'admin.saved', () => this.roles.reload());
  }

  protected setNew(key: 'code' | 'nameAr' | 'nameEn' | 'copyFrom', value: string): void {
    this.newRole.update((r) => ({ ...r, [key]: key === 'code' ? value.trim().toLowerCase() : value }));
  }

  protected create(event: Event): void {
    event.preventDefault();
    const r = this.newRole();
    const source = this.roles.value()?.find((role) => role.code === r.copyFrom);
    void this.actions.run(this.api.createRole({ code: r.code, nameAr: r.nameAr, nameEn: r.nameEn, permissions: source?.permissions ?? [] }), 'admin.saved', () => {
      this.newOpen.set(false);
      this.roles.reload();
      this.selected.set(r.code);
    });
  }
}

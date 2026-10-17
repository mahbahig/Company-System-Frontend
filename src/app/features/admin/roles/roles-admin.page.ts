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
import { LocalPager } from '../../../shared/crm/pagination/local-pager';
import { PagerComponent } from '../../../shared/crm/pagination/pager.component';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';
import { PagerSizeComponent } from '../../../shared/crm/pagination/page-size-select.component';

type ScopeValue = '' | 'own' | 'team' | 'all';

/**
 * RBAC-01..03 roles and the permission matrix: for each permission, the
 * scope a role holds it with (own records, team, whole company) or not at all.
 * System roles can be edited but not renamed by code; changes are audited
 * and apply on the next request.
 */
/** Roles whose grants come from their definitions (see RolesService FIXED_GRANTS). */
const FIXED_ROLES = new Set(['system_administrator', 'ceo']);

@Component({
  selector: 'app-roles-admin-page',
  imports: [TranslatePipe, AlertComponent, BadgeComponent, ButtonDirective, DialogComponent, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS, PagerComponent, CreateIconComponent, PagerSizeComponent],
  templateUrl: './roles-admin.page.html',
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
  /** The administrator (every permission) and the CEO (every business permission) are defined by the system, not edited here. */
  protected readonly fixed = computed(() => FIXED_ROLES.has(this.current()?.code ?? ''));
  protected readonly visiblePermissions = computed(() => {
    const f = this.filter().trim().toLowerCase();
    return (this.catalogue.value() ?? []).filter((p) => !f || p.code.includes(f));
  });
  /** The permission catalogue of the matrix, paged in memory (a fixed, code-defined list); a new filter starts from page 1. */
  protected readonly permissionsPager = new LocalPager(() => this.visiblePermissions());

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

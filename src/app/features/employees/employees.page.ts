import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { KeyRound, LogOut, Pencil, UserCheck, UserRound, UserX } from 'lucide';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { isSuperAdministrator } from '../../core/auth/super-administrator';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../core/reference/reference-data.service';
import type { FilterDefinition } from '../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../shared/crm/list-toolbar/list-toolbar.component';
import { PaginationComponent } from '../../shared/crm/pagination/pagination.component';
import { EnumLabelPipe } from '../../shared/crm/status-badge/enum-label.pipe';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../shared/ui/table/table.imports';
import { ActionRunner } from '../../shared/utils/action-runner';
import { AdminApi, type AdminUser, type Role } from '../admin/admin-api.service';
import { SkeletonRowComponent } from '../../shared/ui/skeleton/skeleton.component';
import { AvatarComponent } from '../../shared/ui/avatar/avatar.component';
import { EmployeeAccountActions } from './employee-account-actions.service';
import { EmployeeDeactivateComponent } from './employee-deactivate.component';
import { EmployeeEditorComponent } from './employee-editor.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../shared/crm/pagination/page-size';
import { CreateIconComponent } from '../../shared/ui/create-icon/create-icon.component';
import { PageSizeSelectComponent } from '../../shared/crm/pagination/page-size-select.component';

const idOf = (value: string | { id: string } | null | undefined): string => (!value ? '' : typeof value === 'string' ? value : value.id);

/** Built-in roles, for the directory's role filter when role definitions are not readable (CEO). */
const ROLE_CODES = ['system_administrator', 'ceo', 'read_only_executive', 'sales_manager', 'sales_representative', 'telesales', 'marketing', 'project_manager', 'technical_lead', 'technical_proposal_engineer', 'financial_proposal_manager', 'installation_crew'];

/**
 * The Employees page (`/employees`). USER-01..05 account administration:
 * profile, roles, teams, manager, territories (governorates), lead capacity
 * and availability; deactivation revokes sessions and can move all open work
 * to another employee; temporary passwords and forced sign-out.
 *
 * One page, three audiences — the API decides who is listed (rows, totals and
 * pages are scoped server-side, never filtered here):
 * - account administrators (`administration.manage_users`, System Administrator
 *   only): everyone, with every action — except on another Super
 *   Administrator's row, which is read only (the API refuses every change);
 * - the CEO (`users.view_performance`, company scope): everyone, read only;
 * - a Sales Manager (`users.view_performance`, team scope): only the Sales
 *   Representatives who report to them, read only.
 * Every row opens that employee's page, where the same actions are offered.
 */
@Component({
  selector: 'app-employees-page',
  imports: [
    AvatarComponent,
    RouterLink,
    SkeletonRowComponent,
    TranslatePipe,
    EnumLabelPipe,
    AlertComponent,
    BadgeComponent,
    ButtonDirective,
    IconComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    PaginationComponent,
    EmployeeEditorComponent,
    EmployeeDeactivateComponent,
    ...TABLE_IMPORTS, CreateIconComponent, PageSizeSelectComponent],
  templateUrl: './employees.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class EmployeesPage {
  protected readonly api = inject(AdminApi);
  protected readonly auth = inject(AuthService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  private readonly accountActions = inject(EmployeeAccountActions);
  protected readonly icons = { edit: Pencil, deactivate: UserX, activate: UserCheck, reset: KeyRound, logOut: LogOut, own: UserRound };

  readonly q = input<string>();
  readonly role = input<string>();
  readonly active = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly data = rxResource({ params: () => ({ q: this.q(), role: this.role(), active: this.active(), page: this.page(), pageSize: this.pageSize() }), stream: ({ params }) => this.api.users(params) });
  /** Account administration (System Administrator); the CEO and Sales Managers read the directory only. */
  protected readonly canManage = computed(() => this.auth.can('administration.manage_users'));
  /** A Sales Manager: the API lists only the Sales Representatives who report to them. */
  protected readonly teamOnly = computed(() => !this.canManage() && !this.auth.can('users.view_performance', 'all'));
  protected readonly emptyKey = computed(() =>
    this.q() || this.role() || this.active() ? 'ux.employees.empty' : this.teamOnly() ? 'ux.employees.teamEmpty' : 'admin.empty',
  );
  /** Role definitions are security data: loaded only for account administrators (others read role names from i18n). */
  protected readonly roles = rxResource({ params: () => (this.canManage() ? true : undefined), stream: ({ params }) => (params ? this.api.roles() : of([] as Role[])) });
  protected readonly teams = rxResource({ stream: () => this.api.teams() });
  protected readonly rows = computed(() => (this.data.hasValue() ? this.data.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    // A Sales Manager's list holds Sales Representatives only, so a role filter would offer nothing.
    ...(this.teamOnly() ? [] : [this.roleFilter()]),
    { name: 'active', label: this.i18n.t('admin.users.status'), options: [{ value: 'true', label: this.i18n.t('admin.active') }, { value: 'false', label: this.i18n.t('admin.inactive') }], value: this.active() ?? '' },
  ]);

  private roleFilter(): FilterDefinition {
    return {
      name: 'role',
      label: this.i18n.t('admin.users.roles'),
      options: this.canManage()
        ? (this.roles.value() ?? []).map((r) => ({ value: r.code, label: this.i18n.pick(r.nameAr, r.nameEn) }))
        : ROLE_CODES.map((code) => ({ value: code, label: this.i18n.t(`enums.roleCode.${code}`) })),
      value: this.role() ?? '',
    };
  }

  protected readonly editorOpen = signal(false);
  /** The employee in the editor; null invites a new one. */
  protected readonly editingUser = signal<AdminUser | null>(null);
  protected readonly secret = signal<string | null>(null);
  protected readonly deactivateOpen = signal(false);
  protected readonly target = signal<AdminUser | null>(null);

  constructor() {
    void this.reference.load();
  }

  protected roleNames(codes: string[]): string {
    const roles = this.roles.value() ?? [];
    return codes.map((code) => roles.find((r) => r.code === code)).map((r, i) => (r ? this.i18n.pick(r.nameAr, r.nameEn) : this.i18n.t(`enums.roleCode.${codes[i]}`))).join('، ');
  }

  protected teamNames(user: AdminUser): string {
    const teams = this.teams.value() ?? [];
    return user.teamIds.map((t) => teams.find((team) => team.id === idOf(t))).filter((t) => !!t).map((t) => this.i18n.pick(t!.nameAr, t!.nameEn)).join('، ') || '—';
  }

  /** The signed-in administrator's own row: their account is managed on their profile. */
  protected isSelf(user: AdminUser): boolean {
    return user.id === this.auth.user()?.id;
  }

  /** Another Super Administrator: read only — no edit, lock, reactivation, password reset or session control (the API refuses them). */
  protected isPeerAdmin(user: AdminUser): boolean {
    return !this.isSelf(user) && isSuperAdministrator(user);
  }

  /** Opens the editor: an employee to edit, or null to invite a new one. */
  protected edit(user: AdminUser | null): void {
    this.actions.error.set(null);
    this.editingUser.set(user);
    this.editorOpen.set(true);
  }

  protected onSaved(messageKey: string): void {
    this.actions.message.set(this.i18n.t(messageKey));
    this.secret.set(null);
    this.data.reload();
  }

  protected startDeactivate(user: AdminUser): void {
    this.actions.error.set(null);
    this.target.set(user);
    this.deactivateOpen.set(true);
  }

  protected onDeactivated(): void {
    this.actions.message.set(this.i18n.t('admin.users.deactivated'));
    this.data.reload();
  }

  protected async reset(user: AdminUser): Promise<void> {
    const temporaryPassword = await this.accountActions.resetPassword(user);
    if (temporaryPassword === null) return;
    this.secret.set(temporaryPassword);
    this.actions.message.set(this.i18n.t('admin.users.passwordReset'));
  }

  /** Logs the employee out everywhere — the session they are using included. */
  protected async logOutEverywhere(user: AdminUser): Promise<void> {
    if (await this.accountActions.logOutEverywhere(user)) this.actions.message.set(this.i18n.t('admin.users.loggedOut'));
  }

  protected async activate(user: AdminUser): Promise<void> {
    if (!(await this.accountActions.activate(user))) return;
    this.actions.message.set(this.i18n.t('admin.users.activated'));
    this.data.reload();
  }
}

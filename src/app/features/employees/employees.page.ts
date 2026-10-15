import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of, type Observable } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../core/reference/reference-data.service';
import type { FilterDefinition } from '../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../shared/crm/list-toolbar/list-toolbar.component';
import { PaginationComponent } from '../../shared/crm/pagination/pagination.component';
import { EnumLabelPipe } from '../../shared/crm/status-badge/enum-label.pipe';
import { UserSelectComponent } from '../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../shared/ui/table/table.imports';
import { ActionRunner } from '../../shared/utils/action-runner';
import { AdminApi, type AdminUser, type Role } from '../admin/admin-api.service';
import { SkeletonRowComponent } from '../../shared/ui/skeleton/skeleton.component';

interface Draft {
  email: string;
  fullNameAr: string;
  fullNameEn: string;
  employeeNo: string;
  jobTitleAr: string;
  jobTitleEn: string;
  mobile: string;
  department: string;
  roleCodes: string[];
  teamIds: string[];
  managerId: string;
  territories: string[];
  specializations: string;
  leadCapacity: string;
  availability: string;
  availabilityTo: string;
  defaultLocale: string;
}

const EMPTY: Draft = {
  email: '',
  fullNameAr: '',
  fullNameEn: '',
  employeeNo: '',
  jobTitleAr: '',
  jobTitleEn: '',
  mobile: '',
  department: '',
  roleCodes: [],
  teamIds: [],
  managerId: '',
  territories: [],
  specializations: '',
  leadCapacity: '',
  availability: 'available',
  availabilityTo: '',
  defaultLocale: 'ar',
};

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
 *   only): everyone, with every action;
 * - the CEO (`users.view_performance`, company scope): everyone, read only;
 * - a Sales Manager (`users.view_performance`, team scope): only the Sales
 *   Representatives who report to them, read only.
 * Every row opens that employee's performance page.
 */
@Component({
  selector: 'app-employees-page',
  imports: [RouterLink, SkeletonRowComponent, TranslatePipe, EnumLabelPipe, UserSelectComponent, AlertComponent, BadgeComponent, ButtonDirective, DialogComponent, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './employees.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class EmployeesPage {
  protected readonly api = inject(AdminApi);
  protected readonly auth = inject(AuthService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly q = input<string>();
  readonly role = input<string>();
  readonly active = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly data = rxResource({ params: () => ({ q: this.q(), role: this.role(), active: this.active(), page: this.page() }), stream: ({ params }) => this.api.users(params) });
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
  protected readonly editing = signal<string | null>(null);
  protected readonly editingSelf = computed(() => !!this.editing() && this.editing() === this.auth.user()?.id);
  protected readonly d = signal<Draft>({ ...EMPTY });
  protected readonly secret = signal<string | null>(null);
  protected readonly valid = computed(() => {
    const d = this.d();
    return d.email.includes('@') && !!d.fullNameAr.trim() && !!d.fullNameEn.trim() && d.roleCodes.length > 0;
  });

  protected readonly deactivateOpen = signal(false);
  protected readonly target = signal<string | null>(null);
  protected readonly reason = signal('');
  protected readonly reassignTo = signal('');
  protected readonly openWork = rxResource({ params: () => this.target() ?? undefined, stream: ({ params }) => this.api.openWork(params) });

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

  protected edit(user: AdminUser | null): void {
    this.actions.error.set(null);
    this.editing.set(user?.id ?? null);
    this.d.set(
      user
        ? {
            email: user.email,
            fullNameAr: user.fullNameAr,
            fullNameEn: user.fullNameEn,
            employeeNo: user.employeeNo ?? '',
            jobTitleAr: user.jobTitleAr ?? '',
            jobTitleEn: user.jobTitleEn ?? '',
            mobile: user.mobile ?? '',
            department: user.department ?? '',
            roleCodes: [...user.roleCodes],
            teamIds: user.teamIds.map(idOf),
            managerId: idOf(user.managerId),
            territories: [...(user.territories ?? [])],
            specializations: (user.specializations ?? []).join(', '),
            leadCapacity: String(user.leadCapacity ?? ''),
            availability: user.availability?.status ?? 'available',
            availabilityTo: user.availability?.to?.slice(0, 10) ?? '',
            defaultLocale: user.defaultLocale ?? 'ar',
          }
        : { ...EMPTY },
    );
    this.editorOpen.set(true);
  }

  protected set(key: keyof Draft, value: string): void {
    this.d.update((d) => ({ ...d, [key]: value }));
  }

  protected toggle(key: 'roleCodes' | 'teamIds', value: string, on: boolean): void {
    this.d.update((d) => ({ ...d, [key]: on ? [...d[key], value] : d[key].filter((v) => v !== value) }));
  }

  protected setTerritories(event: Event): void {
    const values = Array.from((event.target as HTMLSelectElement).selectedOptions).map((o) => o.value);
    this.d.update((d) => ({ ...d, territories: values }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    const d = this.d();
    const body: Record<string, unknown> = {
      fullNameAr: d.fullNameAr.trim(),
      fullNameEn: d.fullNameEn.trim(),
      employeeNo: d.employeeNo || undefined,
      jobTitleAr: d.jobTitleAr || undefined,
      jobTitleEn: d.jobTitleEn || undefined,
      mobile: d.mobile || undefined,
      department: d.department || undefined,
      ...(this.editingSelf() ? {} : { roleCodes: d.roleCodes }),
      teamIds: d.teamIds,
      managerId: d.managerId || null,
      territories: d.territories,
      specializations: d.specializations.split(',').map((s) => s.trim()).filter(Boolean),
      leadCapacity: d.leadCapacity ? Number(d.leadCapacity) : undefined,
      availability: { status: d.availability, to: d.availability !== 'available' && d.availabilityTo ? d.availabilityTo : undefined },
      defaultLocale: d.defaultLocale,
    };
    const id = this.editing();
    const request: Observable<AdminUser & { temporaryPassword?: string }> = id ? this.api.updateUser(id, body) : this.api.createUser({ ...body, email: d.email.trim() });
    void this.actions.run(request, 'admin.saved', (result) => {
      this.editorOpen.set(false);
      this.secret.set(result.temporaryPassword ?? null);
      this.data.reload();
    });
  }

  protected startDeactivate(user: AdminUser): void {
    this.actions.error.set(null);
    this.reason.set('');
    this.reassignTo.set('');
    this.target.set(user.id);
    this.deactivateOpen.set(true);
  }

  protected deactivate(event: Event): void {
    event.preventDefault();
    const id = this.target();
    if (!id) return;
    void this.actions.run(this.api.deactivate(id, this.reason().trim(), this.reassignTo()), 'admin.users.deactivated', () => {
      this.deactivateOpen.set(false);
      this.data.reload();
    });
  }

  protected reset(user: AdminUser): void {
    if (!confirm(this.i18n.t('admin.users.resetConfirm', { name: this.i18n.pick(user.fullNameAr, user.fullNameEn) }))) return;
    void this.actions.run(this.api.resetPassword(user.id), 'admin.users.passwordReset', (result) => this.secret.set(result.temporaryPassword));
  }

  protected run(action: Observable<unknown>, key: string): void {
    void this.actions.run(action, key, () => this.data.reload());
  }
}

import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { AdminApi, type AdminUser } from '../admin-api.service';

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

/**
 * USER-01..05 user administration: profile, roles, teams, manager,
 * territories (governorates), lead capacity and availability; deactivation
 * revokes sessions and can move all open work to another user; temporary
 * passwords and forced sign-out.
 */
@Component({
  selector: 'app-users-admin-page',
  imports: [TranslatePipe, EnumLabelPipe, UserSelectComponent, AlertComponent, BadgeComponent, ButtonDirective, DialogComponent, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-page-header [heading]="'admin.users.title' | t" [subtitle]="'admin.users.subtitle' | t" class="!mb-0">
      <button type="button" appButton (click)="edit(null)">{{ 'admin.users.new' | t }}</button>
    </app-page-header>
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    @if (secret(); as s) {
      <app-alert variant="destructive">
        {{ 'admin.users.temporaryPassword' | t }} <code class="ms-1 rounded bg-muted px-2 py-0.5 font-mono" dir="ltr">{{ s }}</code>
      </app-alert>
    }
    <app-list-toolbar [searchValue]="q() ?? ''" [filters]="filters()" />
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    <app-table-wrapper [label]="'admin.users.title' | t" [attr.aria-busy]="data.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'admin.users.name' | t }}</th>
            <th appTableHead>{{ 'admin.users.roles' | t }}</th>
            <th appTableHead>{{ 'admin.users.teams' | t }}</th>
            <th appTableHead>{{ 'admin.users.capacity' | t }}</th>
            <th appTableHead>{{ 'admin.users.lastLogin' | t }}</th>
            <th appTableHead>{{ 'admin.users.status' | t }}</th>
            <th appTableHead><span class="sr-only">{{ 'admin.actions' | t }}</span></th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (u of rows(); track u.id) {
            <tr appTableRow>
              <td appTableCell>
                <span class="font-medium">{{ i18n.pick(u.fullNameAr, u.fullNameEn) }}</span>
                <span class="block text-xs text-muted-foreground" dir="ltr">{{ u.email }}</span>
              </td>
              <td appTableCell class="text-xs">{{ roleNames(u.roleCodes) }}</td>
              <td appTableCell class="text-xs">{{ teamNames(u) }}</td>
              <td appTableCell class="tabular">{{ i18n.formatNumber(u.leadCapacity) }}</td>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(u.lastLoginAt, true) || '—' }}</td>
              <td appTableCell>
                <app-badge [tone]="u.isActive ? 'success' : 'danger'">{{ (u.isActive ? 'admin.active' : 'admin.inactive') | t }}</app-badge>
                @if (u.mfaEnabled) {
                  <app-badge tone="info" class="ms-1">2FA</app-badge>
                }
                @if (u.availability && u.availability.status !== 'available') {
                  <app-badge tone="warning" class="ms-1">{{ u.availability.status | enum: 'availabilityStatus' }}</app-badge>
                }
              </td>
              <td appTableCell>
                <div class="flex flex-wrap gap-1">
                  <button type="button" appButton variant="ghost" size="sm" (click)="edit(u)">{{ 'crm.common.edit' | t }}</button>
                  @if (u.isActive) {
                    <button type="button" appButton variant="ghost" size="sm" (click)="startDeactivate(u)">{{ 'admin.users.deactivate' | t }}</button>
                    <button type="button" appButton variant="ghost" size="sm" [disabled]="actions.busy()" (click)="reset(u)">{{ 'admin.users.resetPassword' | t }}</button>
                    @if (auth.user()?.isAdmin) {
                      <button type="button" appButton variant="ghost" size="sm" [disabled]="actions.busy()" (click)="run(api.forceLogout(u.id), 'admin.users.loggedOut')">{{ 'admin.users.forceLogout' | t }}</button>
                    }
                  } @else {
                    <button type="button" appButton variant="ghost" size="sm" [disabled]="actions.busy()" (click)="run(api.activate(u.id), 'admin.users.activated')">{{ 'admin.users.activate' | t }}</button>
                  }
                </div>
              </td>
            </tr>
          } @empty {
            <tr app-table-empty [colSpan]="7">{{ (data.isLoading() ? 'common.labels.loading' : 'admin.empty') | t }}</tr>
          }
        </tbody>
      </table>
    </app-table-wrapper>
    @if (data.hasValue()) {
      <app-pagination [page]="data.value().page" [pageCount]="data.value().pageCount" [total]="data.value().total" [pageSize]="data.value().pageSize" />
    }

    <app-dialog [(open)]="editorOpen" [heading]="(editing() ? 'admin.users.edit' : 'admin.users.new') | t">
      <form class="grid gap-4 sm:grid-cols-2" (submit)="save($event)">
        @if (actions.error(); as text) {
          <app-alert variant="destructive" class="sm:col-span-2">{{ text }}</app-alert>
        }
        <div>
          <label appLabel for="u-email" required>{{ 'auth.login.emailLabel' | t }}</label>
          <input appInput id="u-email" type="email" dir="ltr" [disabled]="!!editing()" [value]="d().email" (input)="set('email', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="u-empno">{{ 'admin.users.employeeNo' | t }}</label>
          <input appInput id="u-empno" dir="ltr" [value]="d().employeeNo" (input)="set('employeeNo', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="u-name-ar" required>{{ 'admin.users.nameAr' | t }}</label>
          <input appInput id="u-name-ar" dir="rtl" [value]="d().fullNameAr" (input)="set('fullNameAr', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="u-name-en" required>{{ 'admin.users.nameEn' | t }}</label>
          <input appInput id="u-name-en" dir="ltr" [value]="d().fullNameEn" (input)="set('fullNameEn', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="u-job-ar">{{ 'admin.users.jobTitleAr' | t }}</label>
          <input appInput id="u-job-ar" dir="rtl" [value]="d().jobTitleAr" (input)="set('jobTitleAr', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="u-job-en">{{ 'admin.users.jobTitleEn' | t }}</label>
          <input appInput id="u-job-en" dir="ltr" [value]="d().jobTitleEn" (input)="set('jobTitleEn', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="u-mobile">{{ 'crm.customers.fields.mobile' | t }}</label>
          <input appInput id="u-mobile" type="tel" dir="ltr" [value]="d().mobile" (input)="set('mobile', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="u-dept">{{ 'admin.users.department' | t }}</label>
          <input appInput id="u-dept" [value]="d().department" (input)="set('department', $any($event.target).value)" />
        </div>
        <fieldset class="sm:col-span-2">
          <legend class="mb-1 text-sm font-medium">{{ 'admin.users.roles' | t }} *</legend>
          <div class="grid gap-1 sm:grid-cols-2">
            @for (role of roles.value() ?? []; track role.code) {
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="d().roleCodes.includes(role.code)" (change)="toggle('roleCodes', role.code, $any($event.target).checked)" /> {{ i18n.pick(role.nameAr, role.nameEn) }}</label>
            }
          </div>
        </fieldset>
        <fieldset class="sm:col-span-2">
          <legend class="mb-1 text-sm font-medium">{{ 'admin.users.teams' | t }}</legend>
          <div class="grid gap-1 sm:grid-cols-2">
            @for (team of teams.value() ?? []; track team.id) {
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="d().teamIds.includes(team.id)" (change)="toggle('teamIds', team.id, $any($event.target).checked)" /> {{ i18n.pick(team.nameAr, team.nameEn) }}</label>
            }
          </div>
        </fieldset>
        <div>
          <label appLabel for="u-manager">{{ 'admin.users.manager' | t }}</label>
          <app-user-select inputId="u-manager" [value]="d().managerId" (valueChange)="set('managerId', $event)" />
        </div>
        <div>
          <label appLabel for="u-capacity">{{ 'admin.users.capacity' | t }}</label>
          <input appInput id="u-capacity" type="number" min="0" dir="ltr" [value]="d().leadCapacity" (input)="set('leadCapacity', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="u-territories">{{ 'admin.users.territories' | t }}</label>
          <select id="u-territories" multiple class="h-28 w-full rounded-md border border-input bg-background p-1 text-sm" (change)="setTerritories($event)">
            @for (option of reference.options('governorate'); track option.value) {
              <option [value]="option.value" [selected]="d().territories.includes(option.value)">{{ option.label }}</option>
            }
          </select>
        </div>
        <div>
          <label appLabel for="u-spec">{{ 'admin.users.specializations' | t }}</label>
          <input appInput id="u-spec" [value]="d().specializations" (input)="set('specializations', $any($event.target).value)" />
          <p class="mt-1 text-xs text-muted-foreground">{{ 'admin.users.commaSeparated' | t }}</p>
        </div>
        <div>
          <label appLabel for="u-avail">{{ 'admin.users.availability' | t }}</label>
          <app-select>
            <select appSelect id="u-avail" [value]="d().availability" (change)="set('availability', $any($event.target).value)">
              @for (status of ['available', 'leave', 'out_of_office']; track status) {
                <option [value]="status">{{ status | enum: 'availabilityStatus' }}</option>
              }
            </select>
          </app-select>
        </div>
        @if (d().availability !== 'available') {
          <div>
            <label appLabel for="u-avail-to">{{ 'admin.users.availableFrom' | t }}</label>
            <input appInput id="u-avail-to" type="date" dir="ltr" [value]="d().availabilityTo" (change)="set('availabilityTo', $any($event.target).value)" />
          </div>
        }
        <div>
          <label appLabel for="u-locale">{{ 'admin.users.language' | t }}</label>
          <app-select>
            <select appSelect id="u-locale" [value]="d().defaultLocale" (change)="set('defaultLocale', $any($event.target).value)">
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </app-select>
        </div>
        <div class="flex gap-2 sm:col-span-2">
          <button type="submit" appButton [disabled]="actions.busy() || !valid()">{{ 'crm.common.save' | t }}</button>
          <button type="button" appButton variant="outline" (click)="editorOpen.set(false)">{{ 'crm.common.cancel' | t }}</button>
        </div>
      </form>
    </app-dialog>

    <app-dialog [(open)]="deactivateOpen" [heading]="'admin.users.deactivate' | t">
      <form class="flex flex-col gap-4" (submit)="deactivate($event)">
        @if (actions.error(); as text) {
          <app-alert variant="destructive">{{ text }}</app-alert>
        }
        @if (openWork.value(); as work) {
          @if (work.length) {
            <div class="rounded-md border border-border p-3 text-sm">
              <p class="mb-1 font-medium">{{ 'admin.users.openWork' | t }}</p>
              <ul class="grid grid-cols-2 gap-1">
                @for (w of work; track w.module) {
                  <li>{{ 'admin.users.modules.' + w.module | t }}: <span class="tabular font-medium">{{ i18n.formatNumber(w.count) }}</span></li>
                }
              </ul>
            </div>
          } @else {
            <p class="text-sm text-muted-foreground">{{ 'admin.users.noOpenWork' | t }}</p>
          }
        }
        <div>
          <label appLabel for="dz-reassign">{{ 'admin.users.reassignTo' | t }}</label>
          <app-user-select inputId="dz-reassign" [(value)]="reassignTo" />
        </div>
        <div>
          <label appLabel for="dz-reason" required>{{ 'handoffs.reason' | t }}</label>
          <input appInput id="dz-reason" [value]="reason()" (input)="reason.set($any($event.target).value)" />
        </div>
        <button type="submit" appButton variant="destructive" class="self-start" [disabled]="actions.busy() || !reason().trim()">{{ 'admin.users.deactivate' | t }}</button>
      </form>
    </app-dialog>
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class UsersAdminPage {
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
  protected readonly roles = rxResource({ stream: () => this.api.roles() });
  protected readonly teams = rxResource({ stream: () => this.api.teams() });
  protected readonly rows = computed(() => (this.data.hasValue() ? this.data.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'role', label: this.i18n.t('admin.users.roles'), options: (this.roles.value() ?? []).map((r) => ({ value: r.code, label: this.i18n.pick(r.nameAr, r.nameEn) })), value: this.role() ?? '' },
    { name: 'active', label: this.i18n.t('admin.users.status'), options: [{ value: 'true', label: this.i18n.t('admin.active') }, { value: 'false', label: this.i18n.t('admin.inactive') }], value: this.active() ?? '' },
  ]);

  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<string | null>(null);
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
      roleCodes: d.roleCodes,
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

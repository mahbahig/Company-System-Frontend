import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { Eye, EyeOff } from 'lucide';
import type { Observable } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { passwordPolicyProblem } from '../../core/auth/password-policy';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../core/reference/reference-data.service';
import { EnumLabelPipe } from '../../shared/crm/status-badge/enum-label.pipe';
import { UserSelectComponent } from '../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../shared/ui/form/form.imports';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ActionRunner } from '../../shared/utils/action-runner';
import { AdminApi, type AdminUser, type Role, type Team } from '../admin/admin-api.service';

/** The employee editor's values — in memory only while the dialog is open (no draft is ever kept or sent). */
interface EmployeeForm {
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

const EMPTY_FORM: EmployeeForm = {
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
 * The New / Edit employee dialog (USER-01..04), shared by the Employees list
 * and an employee's page. The values live in memory only while it is open:
 * Cancel, ✕ and Escape discard them, nothing is ever kept as a draft or sent
 * before Save, and every opening starts from a fresh form. Inviting takes
 * the initial password twice (the API creates the account with
 * `mustChangePassword`); nobody changes their own roles. Never opened for
 * another Super Administrator — the API refuses every change to one.
 */
@Component({
  selector: 'app-employee-editor',
  imports: [TranslatePipe, EnumLabelPipe, UserSelectComponent, AlertComponent, ButtonDirective, DialogComponent, IconComponent, ...FORM_IMPORTS],
  templateUrl: './employee-editor.component.html',
})
export class EmployeeEditorComponent {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly icons = { show: Eye, hide: EyeOff };

  readonly open = model(false);
  /** The employee to edit; null invites a new one. */
  readonly user = input<AdminUser | null>(null);
  readonly roles = input<Role[]>([]);
  readonly teams = input<Team[]>([]);
  /** After the API saved: the success message key. */
  readonly saved = output<string>();

  protected readonly editing = signal<string | null>(null);
  protected readonly editingSelf = computed(() => !!this.editing() && this.editing() === this.auth.user()?.id);
  protected readonly d = signal<EmployeeForm>({ ...EMPTY_FORM });
  /**
   * The new employee's INITIAL password, typed twice (only when inviting). It
   * opens the first sign-in only: the API creates the account with
   * `mustChangePassword`, so the employee then chooses their own.
   */
  protected readonly password = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly showPassword = signal(false);
  protected readonly passwordProblem = computed(() => (this.password() ? passwordPolicyProblem(this.password()) : null));
  protected readonly passwordMismatch = computed(() => !!this.confirmPassword() && this.confirmPassword() !== this.password());
  protected readonly passwordReady = computed(() => !!this.editing() || (!!this.password() && !this.passwordProblem() && this.password() === this.confirmPassword()));
  protected readonly valid = computed(() => {
    const d = this.d();
    return d.email.includes('@') && !!d.fullNameAr.trim() && !!d.fullNameEn.trim() && d.roleCodes.length > 0 && this.passwordReady();
  });

  constructor() {
    void this.reference.load();
    // Opening loads the employee (or a blank form); however it closes (Cancel, ✕, Escape, after saving), what was typed is dropped.
    effect(() => {
      const open = this.open();
      untracked(() => (open ? this.load(this.user()) : this.discard()));
    });
  }

  /** Cancel: discards the typed values and closes — nothing is saved, created or sent. */
  protected cancelEditor(): void {
    this.discard();
    this.open.set(false);
  }

  protected set(key: keyof EmployeeForm, value: string): void {
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
    if (this.actions.busy()) return;
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
    const request: Observable<unknown> = id
      ? this.api.updateUser(id, body)
      : this.api.createUser({ ...body, email: d.email.trim(), password: this.password(), confirmPassword: this.confirmPassword() });
    void this.actions.run(request, null, () => {
      this.open.set(false);
      this.saved.emit(id ? 'admin.saved' : 'admin.users.created');
    });
  }

  private load(user: AdminUser | null): void {
    this.discard();
    this.editing.set(user?.id ?? null);
    if (!user) return;
    this.d.set({
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
    });
  }

  private discard(): void {
    this.d.set({ ...EMPTY_FORM });
    this.password.set('');
    this.confirmPassword.set('');
    this.showPassword.set(false);
    this.editing.set(null);
    this.actions.error.set(null);
  }
}

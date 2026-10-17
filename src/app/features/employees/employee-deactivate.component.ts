import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { UserSelectComponent } from '../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../shared/ui/form/form.imports';
import { ActionRunner } from '../../shared/utils/action-runner';
import { AdminApi, type AdminUser } from '../admin/admin-api.service';

/**
 * Deactivating an employee (USER-05), wherever it starts (the Employees list
 * or the employee's page): says whose access ends and what happens — every
 * session is ended and they can no longer sign in — shows their open work
 * and can move it to someone else, with an optional reason. The dialog
 * closes only once the API confirms; the API refuses it for a Super
 * Administrator or oneself.
 */
@Component({
  selector: 'app-employee-deactivate',
  imports: [TranslatePipe, UserSelectComponent, AlertComponent, ButtonDirective, DialogComponent, ...FORM_IMPORTS],
  templateUrl: './employee-deactivate.component.html',
})
export class EmployeeDeactivateComponent {
  private readonly api = inject(AdminApi);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly open = model(false);
  readonly user = input<Pick<AdminUser, 'id' | 'fullNameAr' | 'fullNameEn'> | null>(null);
  /** After the API deactivated the employee. */
  readonly deactivated = output<void>();

  protected readonly name = computed(() => {
    const user = this.user();
    return user ? this.i18n.pick(user.fullNameAr, user.fullNameEn) : '';
  });
  protected readonly reason = signal('');
  protected readonly reassignTo = signal('');
  protected readonly openWork = rxResource({ params: () => (this.open() ? this.user()?.id : undefined), stream: ({ params }) => this.api.openWork(params) });

  constructor() {
    effect(() => {
      if (!this.open())
        untracked(() => {
          this.reason.set('');
          this.reassignTo.set('');
          this.actions.error.set(null);
        });
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const id = this.user()?.id;
    if (!id || this.actions.busy()) return;
    void this.actions.run(this.api.deactivate(id, this.reason().trim(), this.reassignTo()), null, () => {
      this.open.set(false);
      this.deactivated.emit();
    });
  }
}

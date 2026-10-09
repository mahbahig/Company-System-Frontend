import { Component, booleanAttribute, computed, inject, input, model } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { ApiService } from '../../../core/api/api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SelectComponent } from '../../ui/form/select.component';
import { SelectDirective } from '../../ui/form/select.directive';

interface LookupUser {
  id: string;
  fullNameAr: string;
  fullNameEn: string;
}

/**
 * Active-user picker backed by `GET /users/lookup`, optionally limited to
 * roles (`roles="project_manager,technical_lead"`). Works as a Signal Forms
 * custom control (`[formField]`) or with `[(value)]`.
 */
@Component({
  selector: 'app-user-select',
  imports: [SelectComponent, SelectDirective],
  template: `
    <app-select>
      <select appSelect [id]="inputId()" [value]="value()" [disabled]="disabled()" [attr.aria-invalid]="invalid() ? true : null" (change)="value.set($any($event.target).value)">
        <option value="">{{ placeholder() || i18n.t('crm.common.selectPlaceholder') }}</option>
        @for (user of users(); track user.id) {
          <option [value]="user.id">{{ i18n.pick(user.fullNameAr, user.fullNameEn) }}</option>
        }
      </select>
    </app-select>
  `,
  host: { class: 'block' },
})
export class UserSelectComponent {
  private readonly api = inject(ApiService);
  protected readonly i18n = inject(I18nService);

  readonly value = model('');
  readonly roles = input<string>();
  readonly inputId = input<string>();
  readonly placeholder = input<string>();
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });

  private readonly lookup = rxResource({
    params: () => ({ role: this.roles() || undefined }),
    stream: ({ params }) => this.api.get<LookupUser[]>('users/lookup', params),
  });

  protected readonly users = computed(() => (this.lookup.hasValue() ? this.lookup.value() : []));
}

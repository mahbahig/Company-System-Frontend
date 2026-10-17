import { Component, booleanAttribute, computed, inject, input, model } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SelectComponent } from '../../ui/form/select.component';
import { SelectDirective } from '../../ui/form/select.directive';

interface LookupUser {
  id: string;
  fullNameAr: string;
  fullNameEn: string;
}

/**
 * Active-user picker backed by `GET /users/lookup` (only the people the
 * server lets the viewer see — a manager: their own teams), optionally limited
 * to roles (`roles="project_manager,technical_lead"`). `source="leads/assignees"`
 * lists exactly whom the server accepts as a lead's owner instead. Works as a
 * Signal Forms custom control (`[formField]`) or with `[(value)]`.
 */
@Component({
  selector: 'app-user-select',
  imports: [SelectComponent, SelectDirective],
  templateUrl: './user-select.component.html',
  host: { class: 'block' },
})
export class UserSelectComponent {
  private readonly api = inject(ApiService);
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly value = model('');
  readonly roles = input<string>();
  /** The options endpoint: the scoped directory, or the lead-owner options. */
  readonly source = input<'users/lookup' | 'leads/assignees'>('users/lookup');
  readonly inputId = input<string>();
  readonly placeholder = input<string>();
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });

  private readonly lookup = rxResource({
    params: () => ({ source: this.source(), role: this.roles() || undefined }),
    stream: ({ params: { source, role } }) => this.api.get<LookupUser[]>(source, source === 'users/lookup' ? { role } : {}),
  });

  /** The signed-in user, marked "(you)" in the list (a Sales Manager taking a lead themself). */
  protected readonly meId = computed(() => this.auth.user()?.id ?? null);

  protected readonly users = computed(() => (this.lookup.hasValue() ? this.lookup.value() : []));
}

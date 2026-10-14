import { Service, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../api/api.service';
import { AuthService } from '../auth/auth.service';
import { I18nService } from '../i18n/i18n.service';

interface DirectoryUser {
  id: string;
  fullNameAr: string;
  fullNameEn: string;
}

/**
 * Names of the active users (`GET /users/lookup`), loaded once on demand, so
 * workflow views can show who owns a stage, a next action or a blocker. Users
 * without `users.view` see "assigned" instead of a name — the backend never
 * hands out the directory to them.
 */
@Service()
export class UserDirectory {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly users = signal<Map<string, DirectoryUser> | null>(null);
  private loading: Promise<void> | null = null;

  readonly ready = computed(() => this.users() !== null);

  /** Starts loading the directory (no-op without `users.view` or when already loaded). */
  load(): void {
    if (this.loading || !this.auth.can('users.view')) return;
    this.loading = firstValueFrom(this.api.get<DirectoryUser[]>('users/lookup'))
      .then((rows) => this.users.set(new Map(rows.map((row) => [row.id, row]))))
      .catch(() => this.users.set(new Map()));
  }

  /** Display name of a user id (or an embedded user), in the current locale. */
  name(value: string | { id: string; fullNameAr?: string; fullNameEn?: string } | null | undefined): string {
    if (!value) return this.i18n.t('crm.common.unassigned');
    if (typeof value === 'object') return this.i18n.pick(value.fullNameAr ?? '', value.fullNameEn ?? '') || this.i18n.t('pipeline.assigned');
    const user = this.users()?.get(value);
    return user ? this.i18n.pick(user.fullNameAr, user.fullNameEn) : this.i18n.t('pipeline.assigned');
  }
}

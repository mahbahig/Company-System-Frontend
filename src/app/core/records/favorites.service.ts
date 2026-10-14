import { Service, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { refKey, type RecordHit, type RecordRef } from './record-ref';
import { RecordsApi } from './records-api.service';

/**
 * The signed-in user's favorites (stored server-side, so they follow the
 * user across devices). The list comes from `GET /favorites`, which only
 * returns records the user can open right now — a favorite is never a
 * permission. Loaded lazily, once per user.
 */
@Service()
export class FavoritesService {
  private readonly api = inject(RecordsApi);
  private readonly auth = inject(AuthService);

  readonly hits = signal<RecordHit[]>([]);
  readonly loaded = signal(false);
  readonly busy = signal(false);
  private readonly keys = computed(() => new Set(this.hits().map(refKey)));
  private loadedFor: string | null = null;
  private loading: Promise<void> | null = null;

  constructor() {
    // A different (or no) user: forget the previous user's list.
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      if (userId !== this.loadedFor) {
        this.loadedFor = null;
        this.loading = null;
        this.hits.set([]);
        this.loaded.set(false);
      }
    });
  }

  isFavorite(ref: RecordRef): boolean {
    return this.keys().has(refKey(ref));
  }

  /** Loads once per user; `force` refetches (e.g. when the palette opens). */
  load(force = false): Promise<void> {
    const userId = this.auth.user()?.id ?? null;
    if (!userId) return Promise.resolve();
    if (!force && this.loadedFor === userId) return Promise.resolve();
    this.loading ??= firstValueFrom(this.api.favorites())
      .then((hits) => {
        if ((this.auth.user()?.id ?? null) !== userId) return;
        this.hits.set(hits);
        this.loaded.set(true);
        this.loadedFor = userId;
      })
      .catch(() => undefined)
      .finally(() => (this.loading = null));
    return this.loading;
  }

  /** Pins or unpins; the server re-checks that the record is reachable before pinning. */
  async toggle(ref: RecordRef): Promise<boolean> {
    this.busy.set(true);
    try {
      if (this.isFavorite(ref)) {
        await firstValueFrom(this.api.removeFavorite(ref));
        this.hits.update((hits) => hits.filter((hit) => refKey(hit) !== refKey(ref)));
        return false;
      }
      const hit = await firstValueFrom(this.api.addFavorite(ref));
      this.hits.update((hits) => [hit, ...hits.filter((existing) => refKey(existing) !== refKey(hit))]);
      return true;
    } finally {
      this.busy.set(false);
    }
  }
}

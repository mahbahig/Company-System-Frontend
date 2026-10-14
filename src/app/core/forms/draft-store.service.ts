import { Service, inject } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { LocalStore } from '../storage/local-store.service';
import { DRAFT_PREFIX } from '../storage/storage-keys';

export { DRAFT_PREFIX };
/** Drafts older than this are dropped instead of offered. */
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface StoredDraft<T> {
  value: T;
  savedAt: number;
}

/**
 * Unsent form input kept in this browser only — never sent to the server, so
 * a draft cannot create a record, start a workflow or reach anyone else.
 * Keyed by the signed-in user (another account on the same browser never
 * sees it), expired after a week and removed at sign-out. Restoring a draft
 * only refills the form: saving it still goes through the page's own
 * permission-gated submit and the server's validation.
 */
@Service()
export class DraftStore {
  private readonly store = inject(LocalStore);
  private readonly auth = inject(AuthService);

  read<T>(formKey: string): StoredDraft<T> | null {
    const key = this.key(formKey);
    if (!key) return null;
    try {
      const draft = JSON.parse(this.store.get(key) ?? 'null') as StoredDraft<T> | null;
      if (!draft || typeof draft.savedAt !== 'number' || Date.now() - draft.savedAt > DRAFT_TTL_MS) {
        if (draft) this.store.remove(key);
        return null;
      }
      return draft;
    } catch {
      return null;
    }
  }

  write<T>(formKey: string, value: T): number | null {
    const key = this.key(formKey);
    if (!key) return null;
    const savedAt = Date.now();
    this.store.set(key, JSON.stringify({ value, savedAt } satisfies StoredDraft<T>));
    return savedAt;
  }

  clear(formKey: string): void {
    const key = this.key(formKey);
    if (key) this.store.remove(key);
  }

  private key(formKey: string): string | null {
    const userId = this.auth.user()?.id;
    return userId ? `${DRAFT_PREFIX}${userId}.${formKey}` : null;
  }
}

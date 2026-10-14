import { Service, computed, inject, linkedSignal } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { LocalStore } from '../storage/local-store.service';
import { isRecordType, refKey, type RecordHit, type RecordRef } from './record-ref';

const MAX_RECENT = 12;
const keyFor = (userId: string) => `ecotech.recent.${userId}`;

interface RecentEntry extends RecordRef {
  at: number;
}

/**
 * Recently opened records, per user and per browser. Only `{type, id}` is
 * stored — never a name — and the list is always shown through
 * `RecordsApi.resolve()`, so an entry whose record the user can no longer
 * open (reassigned, permission revoked, deleted) is neither shown nor
 * openable, and is pruned the next time the list is resolved.
 */
@Service()
export class RecentRecords {
  private readonly store = inject(LocalStore);
  private readonly auth = inject(AuthService);

  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  private readonly entries = linkedSignal<string | null, RecentEntry[]>({
    source: this.userId,
    computation: (userId) => (userId ? this.read(userId) : []),
  });

  /** Most recent first. */
  readonly refs = computed<RecordRef[]>(() => this.entries().map(({ type, id }) => ({ type, id })));

  /** Call when a record page has loaded successfully. */
  track(ref: RecordRef): void {
    if (!this.userId() || !isRecordType(ref.type) || !ref.id) return;
    const key = refKey(ref);
    const next = [{ ...ref, at: Date.now() }, ...this.entries().filter((entry) => refKey(entry) !== key)].slice(0, MAX_RECENT);
    this.write(next);
  }

  /** Call when a record page answered "not found / forbidden". */
  forget(ref: RecordRef): void {
    const key = refKey(ref);
    if (this.entries().some((entry) => refKey(entry) === key)) this.write(this.entries().filter((entry) => refKey(entry) !== key));
  }

  /** Drops the references a resolution did not return (no longer reachable). */
  retain(requested: readonly RecordRef[], resolved: readonly RecordHit[]): void {
    const requestedKeys = new Set(requested.map(refKey));
    const kept = new Set(resolved.map(refKey));
    const next = this.entries().filter((entry) => !requestedKeys.has(refKey(entry)) || kept.has(refKey(entry)));
    if (next.length !== this.entries().length) this.write(next);
  }

  private read(userId: string): RecentEntry[] {
    try {
      const parsed = JSON.parse(this.store.get(keyFor(userId)) ?? '[]') as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((entry): entry is RecentEntry => !!entry && isRecordType(entry.type) && typeof entry.id === 'string' && /^[a-f\d]{24}$/i.test(entry.id))
        .slice(0, MAX_RECENT);
    } catch {
      return [];
    }
  }

  private write(entries: RecentEntry[]): void {
    const userId = this.userId();
    if (!userId) return;
    this.entries.set(entries);
    this.store.set(keyFor(userId), JSON.stringify(entries));
  }
}

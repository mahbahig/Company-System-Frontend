import { computed, inject, linkedSignal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import type { PermissionCode } from '../../../core/auth/permission-code';
import { LocalStore } from '../../../core/storage/local-store.service';

/** One table column a user may show or hide. */
export interface ColumnDef {
  id: string;
  /** i18n key of the header. */
  labelKey: string;
  /**
   * Permission(s) needed to see the column at all (any of). Columns the role
   * may not see are never offered, whatever was saved earlier — the user's
   * choice only works inside the permission boundary.
   */
  permission?: PermissionCode | readonly PermissionCode[];
  /** The record's identifying column: always shown, cannot be hidden. */
  locked?: boolean;
  /** Off until the user turns it on. */
  hiddenByDefault?: boolean;
}

interface StoredPrefs {
  hidden: string[];
  shown: string[];
}

/**
 * Show / hide preferences for one list table, per user and browser.
 * `new TableColumns('customers', COLUMNS)` in an injection context, then
 * `@if (columns.show('owner')) { <th …> }` and `[colSpan]="columns.count()"`.
 *
 * The permission boundary is evaluated live from the current profile, so a
 * permission revoked later hides the column even if it was saved as shown.
 * (The API decides which fields it returns; this only governs layout.)
 */
export class TableColumns {
  private readonly store = inject(LocalStore);
  private readonly auth = inject(AuthService);

  /** Columns this role may see — the maximum set the picker offers. */
  readonly allowed = computed(() => this.defs.filter((def) => this.permitted(def)));

  private readonly prefs = linkedSignal<string | null, StoredPrefs>({
    source: () => this.auth.user()?.id ?? null,
    computation: (userId) => (userId ? this.read(userId) : { hidden: [], shown: [] }),
  });

  readonly visible = computed(() => {
    const { hidden, shown } = this.prefs();
    return this.allowed().filter((def) => def.locked || (def.hiddenByDefault ? shown.includes(def.id) : !hidden.includes(def.id)));
  });
  private readonly visibleIds = computed(() => new Set(this.visible().map((def) => def.id)));
  readonly count = computed(() => this.visible().length);
  readonly customized = computed(() => this.prefs().hidden.length > 0 || this.prefs().shown.length > 0);

  constructor(
    private readonly tableId: string,
    private readonly defs: readonly ColumnDef[],
  ) {}

  show(id: string): boolean {
    return this.visibleIds().has(id);
  }

  toggle(id: string): void {
    const def = this.allowed().find((candidate) => candidate.id === id);
    if (!def || def.locked) return;
    const { hidden, shown } = this.prefs();
    const visible = this.show(id);
    const next: StoredPrefs = def.hiddenByDefault
      ? { hidden, shown: visible ? shown.filter((other) => other !== id) : [...shown, id] }
      : { shown, hidden: visible ? [...hidden, id] : hidden.filter((other) => other !== id) };
    this.write(next);
  }

  reset(): void {
    this.write({ hidden: [], shown: [] });
  }

  private permitted(def: ColumnDef): boolean {
    if (!def.permission) return true;
    return typeof def.permission === 'string' ? this.auth.can(def.permission) : this.auth.canAny(def.permission);
  }

  private key(userId: string): string {
    return `ecotech.columns.${userId}.${this.tableId}`;
  }

  private read(userId: string): StoredPrefs {
    try {
      const parsed = JSON.parse(this.store.get(this.key(userId)) ?? '{}') as Partial<StoredPrefs>;
      const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
      return { hidden: strings(parsed.hidden), shown: strings(parsed.shown) };
    } catch {
      return { hidden: [], shown: [] };
    }
  }

  private write(prefs: StoredPrefs): void {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    this.prefs.set(prefs);
    this.store.set(this.key(userId), JSON.stringify(prefs));
  }
}

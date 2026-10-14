import { Service } from '@angular/core';

/**
 * `localStorage` that never throws (private mode, blocked storage, quota):
 * preferences are conveniences, so a failure just means "not remembered".
 */
@Service()
export class LocalStore {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* not persisted */
    }
  }

  /** Removes every key starting with `prefix` (e.g. all form drafts at sign-out). */
  removeByPrefix(prefix: string): void {
    try {
      const keys: string[] = [];
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      for (const key of keys) localStorage.removeItem(key);
    } catch {
      /* nothing to remove */
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing to remove */
    }
  }
}

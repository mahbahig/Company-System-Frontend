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

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing to remove */
    }
  }
}

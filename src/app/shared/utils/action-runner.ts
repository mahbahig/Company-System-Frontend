import { signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';

import type { I18nService } from '../../core/i18n/i18n.service';
import { problemIds } from './problem-ids';

/**
 * Busy / success / error state for a page's write actions, so every action
 * button shows a progress state, a confirmation and a translated error the
 * same way. `const actions = new ActionRunner(i18n)` then
 * `await actions.run(api.submit(id), 'prop.submitted', () => data.reload())`.
 */
export class ActionRunner {
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  /** True after the last action failed: the page should mark its still-empty required fields. */
  readonly failed = signal(false);
  /** Ids of the fields the last failed request named (see `problemIds`). */
  readonly problems = signal<ReadonlySet<string>>(new Set());
  /** The API's validation message key per field from the last failed request (`fieldErrors`), for forms that show it under the field. */
  readonly fieldErrors = signal<Readonly<Record<string, string>>>({});

  constructor(private readonly i18n: I18nService) {}

  async run<T>(action: Observable<T>, successKey: string | null, after?: (result: T) => void): Promise<T | null> {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      const result = await firstValueFrom(action);
      this.failed.set(false);
      this.problems.set(new Set());
      this.fieldErrors.set({});
      if (successKey) this.message.set(this.i18n.t(successKey));
      after?.(result);
      return result;
    } catch (error) {
      this.failed.set(true);
      this.problems.set(problemIds(error));
      this.fieldErrors.set((error as { fieldErrors?: Record<string, string> } | null)?.fieldErrors ?? {});
      this.error.set(this.i18n.errorText(error));
      return null;
    } finally {
      this.busy.set(false);
    }
  }
}

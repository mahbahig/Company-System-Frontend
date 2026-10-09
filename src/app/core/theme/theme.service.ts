import { DOCUMENT } from '@angular/common';
import { DestroyRef, Service, computed, effect, inject, signal } from '@angular/core';

import { LocalStore } from '../storage/local-store.service';
import { THEME_COLORS, isTheme, type Theme } from './theme';

const THEME_KEY = 'ecotech.theme';

/**
 * Light / dark / system theme. The choice is persisted; `index.html` applies
 * it before boot so there is no flash. Under `system`, OS changes apply live.
 */
@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly store = inject(LocalStore);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly theme = signal<Theme>(this.initialTheme());
  readonly resolved = computed<'light' | 'dark'>(() => {
    const theme = this.theme();
    return theme === 'system' ? (this.systemDark() ? 'dark' : 'light') : theme;
  });

  constructor() {
    const onChange = (event: MediaQueryListEvent) => this.systemDark.set(event.matches);
    this.media?.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => this.media?.removeEventListener('change', onChange));

    effect(() => {
      const resolved = this.resolved();
      this.document.documentElement.classList.toggle('dark', resolved === 'dark');
      this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
    });
  }

  choose(theme: Theme): void {
    this.theme.set(theme);
    this.store.set(THEME_KEY, theme);
  }

  private initialTheme(): Theme {
    const stored = this.store.get(THEME_KEY);
    return isTheme(stored) ? stored : 'system';
  }
}

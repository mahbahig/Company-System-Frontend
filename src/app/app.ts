import { Dir } from '@angular/cdk/bidi';
import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { I18nService } from './core/i18n/i18n.service';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { ThemeService } from './core/theme/theme.service';

/**
 * Root: the skip link (first focusable element on every page) and the
 * router outlet. `Dir` gives the CDK (menus, overlays) the live text
 * direction so drop-downs mirror correctly in Arabic.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Dir, TranslatePipe],
  template: `
    <div [dir]="i18n.direction()" class="contents">
      <a
        href="#main-content"
        (click)="skipToContent($event)"
        class="sr-only-focusable absolute start-4 top-4 z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        {{ 'common.labels.skipToContent' | t }}
      </a>
      <router-outlet />
    </div>
  `,
})
export class App {
  protected readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);

  constructor() {
    inject(ThemeService); // applies the stored theme for the whole session
  }

  /** In-page jump without touching the router URL. */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    const main = this.document.getElementById('main-content');
    main?.setAttribute('tabindex', '-1');
    main?.focus();
  }
}

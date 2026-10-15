import { Component, booleanAttribute, input } from '@angular/core';
import { ArrowRight, LoaderCircle } from 'lucide';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/**
 * The sign-in screens' primary action, on a native `<button>` or `<a>` so it
 * keeps its own semantics: a petrol fill with a lit top edge, a light sweep
 * and lift on hover, and a direction-aware arrow. While `busy` it shows a
 * spinner and `busyLabel` without dimming, and sets `aria-busy`; the page
 * still owns `disabled`.
 */
@Component({
  selector: 'button[appAuthButton], a[appAuthButton]',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './auth-button.component.html',
  host: {
    class:
      'group relative isolate inline-flex h-12 w-full select-none items-center justify-center gap-2 overflow-hidden rounded-xl px-5 text-[0.9375rem] font-semibold text-[hsl(var(--primary-fill-foreground))] ' +
      'bg-[hsl(var(--primary-fill))] bg-[linear-gradient(180deg,hsl(0_0%_100%/0.16),hsl(0_0%_100%/0)_60%)] ' +
      'shadow-[inset_0_1px_0_hsl(0_0%_100%/0.22),0_1px_2px_hsl(var(--primary-deep)/0.35),0_12px_28px_-14px_hsl(var(--primary-fill)/0.8)] ' +
      'transition-[translate,box-shadow,background-color] duration-300 ease-premium ' +
      'hover:-translate-y-px hover:bg-[hsl(var(--primary-fill-hover))] hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.22),0_2px_4px_hsl(var(--primary-deep)/0.35),0_18px_36px_-14px_hsl(var(--primary-fill)/0.85)] ' +
      'active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:ring-offset-0 ' +
      'disabled:pointer-events-none [&:disabled:not([aria-busy])]:opacity-55',
    '[attr.aria-busy]': 'busy() || null',
  },
})
export class AuthButtonComponent {
  readonly busy = input(false);
  /** Translation key shown next to the spinner while busy. */
  readonly busyLabel = input('');
  /** Trailing arrow; set `arrow="false"` for a plain label. */
  readonly arrow = input(true, { transform: booleanAttribute });

  protected readonly spinnerIcon = LoaderCircle;
  protected readonly arrowIcon = ArrowRight;
}

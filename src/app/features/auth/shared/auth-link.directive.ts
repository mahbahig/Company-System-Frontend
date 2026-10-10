import { Directive, computed, input } from '@angular/core';

const BASE =
  'inline-flex items-center gap-1.5 rounded-sm text-sm font-medium underline-offset-4 transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const TONES = {
  primary: 'text-primary hover:text-[hsl(var(--primary-hover))]',
  muted: 'text-muted-foreground hover:text-foreground',
} as const;

/** Secondary text action on the sign-in screens (forgot password, switch method, back to sign in). */
@Directive({
  selector: 'a[appAuthLink], button[appAuthLink]',
  host: { '[class]': 'classes()' },
})
export class AuthLinkDirective {
  readonly tone = input<keyof typeof TONES>('primary');

  protected readonly classes = computed(() => `${BASE} ${TONES[this.tone()]}`);
}

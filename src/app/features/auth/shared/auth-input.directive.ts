import { Directive } from '@angular/core';

/**
 * The sign-in screens' text input: taller and softer than the app's dense
 * `appInput`, with a petrol focus halo instead of an offset ring, an
 * error state driven by `aria-invalid`, and autofill kept on-palette.
 * Leave room for an icon / trailing button with `ps-11` / `pe-12`.
 */
@Directive({
  selector: 'input[appAuthInput]',
  host: {
    class:
      'block h-12 w-full min-w-0 rounded-xl border border-input bg-card px-4 text-[0.9375rem] text-foreground shadow-xs placeholder:text-muted-foreground/60 ' +
      'transition-[border-color,box-shadow,background-color] duration-200 ease-premium hover:border-foreground/25 ' +
      'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:ring-offset-0 ' +
      'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/15 disabled:cursor-not-allowed disabled:opacity-60 ' +
      'autofill:shadow-[inset_0_0_0_100px_hsl(var(--card))] autofill:[-webkit-text-fill-color:hsl(var(--foreground))]',
  },
})
export class AuthInputDirective {}

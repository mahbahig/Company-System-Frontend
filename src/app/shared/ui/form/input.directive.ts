import { Directive } from '@angular/core';

/** Text-like input (Next `Input`); red border when `aria-invalid="true"`. */
@Directive({
  selector: 'input[appInput]',
  host: {
    class:
      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 file:border-0 file:bg-transparent file:text-sm file:font-medium aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
  },
})
export class InputDirective {}

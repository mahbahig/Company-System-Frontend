import { Directive } from '@angular/core';

/** Multi-line input (Next `Textarea`). */
@Directive({
  selector: 'textarea[appTextarea]',
  host: {
    class:
      'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
  },
})
export class TextareaDirective {}

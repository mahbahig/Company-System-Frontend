import { Directive } from '@angular/core';

/** Multi-line input (Next `Textarea`). */
@Directive({
  selector: 'textarea[appTextarea]',
  host: {
    class:
      'flex w-full rounded-lg border border-input bg-background shadow-xs transition-[border-color,box-shadow] duration-150 ease-premium hover:border-foreground/25 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-70 disabled:shadow-none disabled:hover:border-input aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
  },
})
export class TextareaDirective {}

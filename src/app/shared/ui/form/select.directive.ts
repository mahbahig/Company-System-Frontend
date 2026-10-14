import { Directive } from '@angular/core';

/** Native select styled like the Next `Select`; wrap it in `<app-select>` for the chevron. */
@Directive({
  selector: 'select[appSelect]',
  host: {
    class:
      'flex h-10 w-full appearance-none rounded-lg border border-input bg-background shadow-xs transition-[border-color,box-shadow] duration-150 ease-premium hover:border-foreground/25 px-3 py-2 pe-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-70 disabled:shadow-none disabled:hover:border-input aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
  },
})
export class SelectDirective {}

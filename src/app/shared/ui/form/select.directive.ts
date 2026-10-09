import { Directive } from '@angular/core';

/** Native select styled like the Next `Select`; wrap it in `<app-select>` for the chevron. */
@Directive({
  selector: 'select[appSelect]',
  host: {
    class:
      'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pe-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
  },
})
export class SelectDirective {}

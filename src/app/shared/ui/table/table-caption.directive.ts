import { Directive } from '@angular/core';

/** Table caption (Next \`TableCaption\`). */
@Directive({
  selector: 'caption[appTableCaption]',
  host: { class: 'py-3 text-sm text-muted-foreground' },
})
export class TableCaptionDirective {}

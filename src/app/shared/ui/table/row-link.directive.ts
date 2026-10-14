import { DOCUMENT } from '@angular/common';
import { Directive, inject, input } from '@angular/core';
import { ActivatedRoute, Router, type Params } from '@angular/router';

/** Clicks on these (or inside them) keep their own behaviour and never open the row. */
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, details, [role="button"], [role="checkbox"], [role="menuitem"], [contenteditable="true"], [data-row-click="ignore"]';

/**
 * Makes a whole table row open its record:
 * `<tr appTableRow [appRowLink]="row.id">` — same commands / relative
 * resolution as the row's own `routerLink` (keep that link in the identifying
 * cell: it is how keyboard and screen-reader users open the record).
 *
 * Clicks on links, buttons, inputs and other controls inside the row keep
 * their own action and do not navigate; neither does a click that ends a text
 * selection. Ctrl / ⌘ / middle click opens the record in a new tab, like a link.
 * A `null` link leaves the row inert.
 */
@Directive({
  selector: 'tr[appRowLink]',
  host: {
    '[class.cursor-pointer]': '!!link()',
    '(click)': 'onClick($event)',
    '(auxclick)': 'onClick($event)',
  },
})
export class RowLinkDirective {
  readonly link = input.required<string | readonly unknown[] | null | undefined>({ alias: 'appRowLink' });
  readonly queryParams = input<Params | null | undefined>(undefined, { alias: 'appRowLinkQueryParams' });

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);

  protected onClick(event: MouseEvent): void {
    const link = this.link();
    if (!link || event.defaultPrevented) return;
    if (event.type === 'auxclick' && event.button !== 1) return;
    const target = event.target as Element | null;
    if (target?.closest(INTERACTIVE)) return;
    if (this.document.getSelection?.()?.toString()) return;
    const commands = typeof link === 'string' ? [link] : [...link];
    const tree = this.router.createUrlTree(commands, { relativeTo: this.route, queryParams: this.queryParams() ?? undefined });
    if (event.ctrlKey || event.metaKey || event.button === 1) {
      this.document.defaultView?.open(this.router.serializeUrl(tree), '_blank', 'noopener');
      return;
    }
    void this.router.navigateByUrl(tree);
  }
}

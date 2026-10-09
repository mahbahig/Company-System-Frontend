import { Component, ElementRef, effect, inject, input } from '@angular/core';
import { createElement, type IconNode } from 'lucide';

/**
 * Renders a lucide icon (the same icon set as `lucide-react` in the Next app).
 * Icons are imported one by one (`import { Sun } from 'lucide'`) so only the
 * icons in use are bundled.
 *
 * The host is `display: contents`, so parent rules such as the button's
 * `[&_svg]:size-4` and flex gaps apply to the <svg> directly. Decorative by
 * default (`aria-hidden`); pass `label` for a meaningful standalone icon.
 */
@Component({
  selector: 'app-icon',
  template: '',
  host: { class: 'contents' },
})
export class IconComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly icon = input.required<IconNode>();
  /** Utility classes for the <svg>, e.g. `size-6 text-primary`. */
  readonly svgClass = input('size-4');
  /** Accessible name; when omitted the icon is hidden from assistive tech. */
  readonly label = input<string>();

  constructor() {
    effect(() => {
      const label = this.label();
      const svg = createElement(this.icon(), {
        class: `shrink-0 ${this.svgClass()}`,
        'stroke-width': 2,
        ...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true', focusable: 'false' }),
      });
      this.host.nativeElement.replaceChildren(svg);
    });
  }
}

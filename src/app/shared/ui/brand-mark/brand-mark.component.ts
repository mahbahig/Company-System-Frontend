import { Component } from '@angular/core';

const RAYS = 18;
const TIP_RADIUS = 50;
const VALLEY_RADIUS = 27;
const HOLE_RADIUS = 16;

/** The ECOTECH sun (ecotecheg.com): eighteen pointed rays round a hollow core, on a 100×100 grid. */
const SUN_MARK_PATH = (() => {
  const rays = Array.from({ length: RAYS * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? TIP_RADIUS : VALLEY_RADIUS;
    const angle = (index * Math.PI) / RAYS - Math.PI / 2;
    return `${index === 0 ? 'M' : 'L'}${(50 + radius * Math.cos(angle)).toFixed(2)} ${(50 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join('');
  const hole = `M${50 + HOLE_RADIUS} 50a${HOLE_RADIUS} ${HOLE_RADIUS} 0 1 0 ${-2 * HOLE_RADIUS} 0a${HOLE_RADIUS} ${HOLE_RADIUS} 0 1 0 ${2 * HOLE_RADIUS} 0Z`;
  return `${rays}Z${hole}`;
})();

/**
 * The ECOTECH sun mark as inline SVG, in solar yellow by default (`currentColor`,
 * so a `text-*` class recolours it). Decorative: pair it with visible text or an
 * accessible name on the surrounding element.
 */
@Component({
  selector: 'app-brand-mark',
  template: `<svg
    viewBox="0 0 100 100"
    class="block size-full"
    aria-hidden="true"
    focusable="false"
  >
    <path [attr.d]="path" fill="currentColor" fill-rule="evenodd" />
  </svg>`,
  host: { class: 'inline-block shrink-0 text-brand-sun' },
})
export class BrandMarkComponent {
  protected readonly path = SUN_MARK_PATH;
}

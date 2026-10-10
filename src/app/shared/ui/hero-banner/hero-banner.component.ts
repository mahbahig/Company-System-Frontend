import { Component } from '@angular/core';

import { DecorComponent } from '../../decor/decor.component';

/**
 * The opening band of a home page (the dashboards): a quiet card surface
 * with the decor centrepiece at its end side, faded out towards the start so
 * the projected heading always reads first. Without WebGL — or before the
 * piece loads — the warm-lit surface stands on its own.
 */
@Component({
  selector: 'app-hero-banner',
  imports: [DecorComponent],
  template: `
    <div aria-hidden="true" class="hero-surface absolute inset-0 -z-10"></div>
    @defer (on idle) {
      <app-decor composition="centerpiece" align="end" class="hero-decor absolute inset-0 -z-10" />
    }
    <div class="relative sm:max-w-[62%]"><ng-content /></div>
  `,
  styles: `
    /* Warm light pooled at the end side (where the piece sits), a breath of
       the primary at the opposite corner. */
    .hero-surface {
      background:
        radial-gradient(
          55% 150% at var(--hero-light-x) 45%,
          hsl(var(--accent) / 0.1),
          transparent 70%
        ),
        radial-gradient(
          45% 120% at var(--hero-shade-x) 110%,
          hsl(var(--primary) / 0.07),
          transparent 70%
        ),
        linear-gradient(hsl(var(--card)), hsl(var(--muted) / 0.55));
    }

    /* The piece fades out towards the text. */
    .hero-decor {
      mask-image: linear-gradient(
        var(--hero-fade),
        black 34%,
        rgb(0 0 0 / 0.3) 70%,
        transparent 96%
      );
    }
  `,
  host: {
    class:
      'relative isolate flex min-h-44 flex-col justify-center overflow-hidden rounded-2xl border border-border/70 bg-card px-5 py-6 shadow-sm [--hero-fade:270deg] [--hero-light-x:85%] [--hero-shade-x:8%] rtl:[--hero-fade:90deg] rtl:[--hero-light-x:15%] rtl:[--hero-shade-x:92%] sm:min-h-48 sm:px-7 sm:py-8 lg:min-h-52',
  },
})
export class HeroBannerComponent {}

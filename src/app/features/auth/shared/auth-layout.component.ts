import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { Rotate3d } from 'lucide';
import { map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LocaleSwitcherComponent } from '../../../core/layout/locale-switcher/locale-switcher.component';
import { ThemeToggleComponent } from '../../../core/layout/theme-toggle/theme-toggle.component';
import { ThemeService } from '../../../core/theme/theme.service';
import { BrandMarkComponent } from '../../../shared/ui/brand-mark/brand-mark.component';
import { BrandWordmarkComponent } from '../../../shared/ui/brand-wordmark/brand-wordmark.component';
import { BRAND_WORDMARK } from '../../../shared/ui/brand-wordmark/brand-wordmark.config';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import type { SceneFraming } from './solar-scene/scene-framing.interface';
import { SolarSceneComponent } from './solar-scene/solar-scene.component';
import { StarSkyComponent } from './star-sky/star-sky.component';

/** Tailwind's `lg` breakpoint: from here the stage and the form sit side by side. */
const WIDE_LAYOUT = '(min-width: 64rem)';
/** Side-by-side: the lockup floats in the upper stage, clear of the brand story below it. */
const STAGE_FRAMING: SceneFraming = { centerY: 0.37, fillWidth: 0.74, fillHeight: 0.46 };
/** Stacked: the lockup fills the compact hero above the form sheet. */
const HERO_FRAMING: SceneFraming = { centerY: 0.47, fillWidth: 0.8, fillHeight: 0.52 };

/**
 * Parent route of every sign-in screen (login, forgot / reset password), so
 * the screens read as one product and the 3D scene lives across navigation
 * between them instead of being rebuilt on each.
 *
 * Wide screens: one layer — a sky filling the page, with twinkling stars and
 * random meteors (a second, flat three.js canvas), and on it the interactive
 * solar scene and brand story beside the form, with no panel between them.
 * The sky follows the app theme — daylight in light mode, a petrol night in
 * dark — and so do both scenes. Narrow screens: the scene becomes a compact
 * hero with its own sky and the form rises over it as a sheet — the form
 * stays the primary, fully reachable surface at every size.
 *
 * Presentational only: the routed pages own all authentication logic.
 * Both canvases are `@defer`red so three.js never delays the form.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [
    RouterOutlet,
    TranslatePipe,
    IconComponent,
    BrandMarkComponent,
    BrandWordmarkComponent,
    LocaleSwitcherComponent,
    ThemeToggleComponent,
    SolarSceneComponent,
    StarSkyComponent,
  ],
  templateUrl: './auth-layout.component.html',
  styles: `
    /* The hero's sky on narrow screens (the --stage-* tokens, per theme).
       Light pools where the sun sits (--sun-y), brand colour rises from the
       lower corners, and the edges fall away into a vignette. On its own it
       is the backdrop before the scene loads, and the whole picture on
       devices without WebGL. */
    .stage-backdrop {
      background:
        radial-gradient(
          120% 85% at 50% var(--sun-y),
          transparent 50%,
          hsl(var(--stage-vignette)) 100%
        ),
        radial-gradient(28% 22% at 50% var(--sun-y), hsl(var(--stage-glow)), transparent 70%),
        radial-gradient(80% 55% at 50% var(--sun-y), hsl(var(--stage-halo)), transparent 72%),
        radial-gradient(75% 50% at 0% 100%, hsl(var(--stage-pool-start)), transparent 70%),
        radial-gradient(60% 45% at 100% 100%, hsl(var(--stage-pool-end)), transparent 70%),
        linear-gradient(hsl(var(--stage-zenith)), hsl(var(--stage-horizon)));
    }

    /* Wide screens: the same light round the sun, on a box twice the stage's
       size centred on it, so it fades out long before reaching any edge. */
    .sun-glow {
      background:
        radial-gradient(14% 11%, hsl(var(--stage-glow)), transparent 70%),
        radial-gradient(40% 27.5%, hsl(var(--stage-halo)), transparent 72%);
    }

    /* The sky behind the whole page on wide screens: the stage's gradient,
       brand colour rising from the horizon and a vignette at the edges. */
    .page-sky {
      background:
        radial-gradient(140% 110% at 50% 45%, transparent 55%, hsl(var(--stage-vignette)) 100%),
        radial-gradient(45% 40% at 0% 100%, hsl(var(--stage-pool-start)), transparent 70%),
        radial-gradient(60% 45% at 50% 105%, hsl(var(--stage-pool-end)), transparent 70%),
        linear-gradient(hsl(var(--stage-zenith)), hsl(var(--stage-horizon)));
    }

    /* A faint engineering grid, dissolving away from the sun. */
    .stage-grid {
      background-image:
        linear-gradient(hsl(var(--stage-line)) 1px, transparent 1px),
        linear-gradient(90deg, hsl(var(--stage-line)) 1px, transparent 1px);
      background-size: 48px 48px;
      background-position: center;
      mask-image: radial-gradient(60% 55% at 50% var(--sun-y), black, transparent 75%);
    }
  `,
  host: {
    class:
      'auth-theme relative isolate flex min-h-dvh flex-col overflow-clip bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(28rem,1fr)] xl:grid-cols-[minmax(0,1.3fr)_minmax(32rem,1fr)]',
  },
})
export class AuthLayoutComponent {
  protected readonly environmentBadge = environment.environmentBadge;
  protected readonly year = new Date().getFullYear();
  protected readonly hintIcon = Rotate3d;
  protected readonly brand = BRAND_WORDMARK;
  protected readonly theme = inject(ThemeService).resolved;

  protected readonly wide = toSignal(
    inject(BreakpointObserver)
      .observe(WIDE_LAYOUT)
      .pipe(map(({ matches }) => matches)),
    { initialValue: false },
  );
  protected readonly framing = computed(() => (this.wide() ? STAGE_FRAMING : HERO_FRAMING));

  protected readonly sceneReady = signal(false);
  protected readonly explored = signal(false);
}

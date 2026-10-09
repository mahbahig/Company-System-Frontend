import { CdkMenu, CdkMenuItemRadio, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, computed, inject } from '@angular/core';
import { Check, Monitor, Moon, Sun, type IconNode } from 'lucide';

import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { THEMES, type Theme } from '../../theme/theme';
import { ThemeService } from '../../theme/theme.service';
import { END_ALIGNED_BELOW } from '../menu-positions';

const ICONS: Record<Theme, IconNode> = { light: Sun, dark: Moon, system: Monitor };

/** Light / Dark / System picker; a tick (not colour alone) marks the active choice. */
@Component({
  selector: 'app-theme-toggle',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItemRadio, ButtonDirective, IconComponent, TranslatePipe],
  template: `
    <button
      type="button"
      appButton
      variant="ghost"
      size="icon"
      [cdkMenuTriggerFor]="menu"
      [cdkMenuPosition]="positions"
      [attr.aria-label]="label()"
    >
      <app-icon [icon]="activeIcon()" />
    </button>

    <ng-template #menu>
      <div
        cdkMenu
        class="z-50 min-w-44 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
      >
        <p class="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground" aria-hidden="true">
          {{ 'common.theme.label' | t }}
        </p>
        @for (option of themes; track option) {
          <button
            type="button"
            cdkMenuItemRadio
            [cdkMenuItemChecked]="option === theme.theme()"
            (cdkMenuItemTriggered)="theme.choose(option)"
            class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none hover:bg-secondary hover:text-secondary-foreground focus:bg-secondary focus:text-secondary-foreground"
          >
            <app-icon [icon]="icons[option]" svgClass="size-4 text-muted-foreground" />
            <span class="flex-1 text-start">{{ 'common.theme.' + option | t }}</span>
            @if (option === theme.theme()) {
              <app-icon [icon]="check" svgClass="size-4 text-primary" />
            }
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  private readonly i18n = inject(I18nService);

  protected readonly themes = THEMES;
  protected readonly icons = ICONS;
  protected readonly check = Check;
  protected readonly positions = END_ALIGNED_BELOW;

  protected readonly activeIcon = computed(() => ICONS[this.theme.theme()]);
  protected readonly label = computed(() => {
    this.i18n.locale();
    return `${this.i18n.t('common.theme.label')}: ${this.i18n.t(`common.theme.${this.theme.theme()}`)}`;
  });
}

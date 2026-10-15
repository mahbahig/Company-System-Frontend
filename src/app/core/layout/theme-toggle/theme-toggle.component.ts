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
import { TooltipDirective } from '../../../shared/ui/tooltip/tooltip.directive';

const ICONS: Record<Theme, IconNode> = { light: Sun, dark: Moon, system: Monitor };

/** Light / Dark / System picker; a tick (not colour alone) marks the active choice. */
@Component({
  selector: 'app-theme-toggle',
  imports: [TooltipDirective, CdkMenuTrigger, CdkMenu, CdkMenuItemRadio, ButtonDirective, IconComponent, TranslatePipe],
  templateUrl: './theme-toggle.component.html',
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

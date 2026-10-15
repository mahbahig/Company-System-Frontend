import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronRight } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { IconComponent } from '../../ui/icon/icon.component';

/** One crumb: a label, and the in-app path (without locale) it links to, if any. */
export interface Crumb {
  label: string;
  path?: string;
}

/**
 * Trail above a deeper page: `Projects / Mahmoud Ahmed / Villa Solar`.
 * A crumb is a link only when the route guard would open its path for this
 * user (`canOpen`); otherwise it is plain text, so the trail never points at a
 * page the role cannot open. The last crumb is the current page.
 */
@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink, IconComponent, TranslatePipe],
  templateUrl: './breadcrumbs.component.html',
  host: { class: 'block min-w-0' },
})
export class BreadcrumbsComponent {
  private readonly navigation = inject(NavigationService);
  private readonly i18n = inject(I18nService);

  readonly items = input.required<Crumb[]>();

  protected readonly separator = ChevronRight;
  protected readonly crumbs = computed(() => {
    this.i18n.locale();
    return this.items()
      .filter((crumb) => !!crumb.label)
      .map((crumb) => ({
        label: crumb.label,
        link: crumb.path && this.navigation.canOpen(crumb.path) ? this.navigation.link(crumb.path) : null,
      }));
  });
}

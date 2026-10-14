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
  template: `
    <nav [attr.aria-label]="'ux.breadcrumbs.label' | t">
      <ol class="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-sm text-muted-foreground">
        @for (crumb of crumbs(); track $index; let last = $last) {
          <li class="flex min-w-0 items-center gap-1">
            @if (last) {
              <span aria-current="page" class="max-w-[16rem] truncate font-medium text-foreground" dir="auto">{{ crumb.label }}</span>
            } @else if (crumb.link) {
              <a [routerLink]="crumb.link" class="max-w-[12rem] truncate rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="auto">{{ crumb.label }}</a>
            } @else {
              <span class="max-w-[12rem] truncate" dir="auto">{{ crumb.label }}</span>
            }
            @if (!last) {
              <app-icon [icon]="separator" svgClass="size-3.5 shrink-0 opacity-60 rtl:-scale-x-100" />
            }
          </li>
        }
      </ol>
    </nav>
  `,
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

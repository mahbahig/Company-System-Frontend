import { Component, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { NavigationService } from '../../navigation/navigation.service';

/**
 * Permission-filtered sidebar links. The active link gets
 * `aria-current="page"`; nested routes (/customers/123) keep "Customers" active.
 */
@Component({
  selector: 'app-sidebar-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent, TranslatePipe],
  template: `
    <nav [attr.aria-label]="'navigation.sections.overview' | t" class="flex flex-col gap-6">
      @for (section of navigation.sections(); track section.labelKey) {
        <div>
          <h2
            class="px-3 pb-2 text-2xs font-semibold uppercase tracking-wider text-sidebar-foreground/65"
          >
            {{ 'navigation.sections.' + section.labelKey | t }}
          </h2>
          <ul class="flex flex-col gap-0.5">
            @for (item of section.items; track item.path) {
              <li>
                <a
                  [routerLink]="navigation.link(item.path)"
                  routerLinkActive="bg-sidebar-accent/15 font-medium !text-sidebar-foreground before:opacity-100 [&_app-icon]:text-sidebar-accent"
                  ariaCurrentWhenActive="page"
                  (click)="navigate.emit()"
                  class="relative flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-[color,background-color] duration-200 ease-premium hover:bg-sidebar-accent/10 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-full before:bg-sidebar-accent before:opacity-0 before:transition-opacity before:duration-200"
                >
                  <app-icon [icon]="item.icon" svgClass="size-4 shrink-0" />
                  <span class="truncate">{{ 'navigation.items.' + item.labelKey | t }}</span>
                </a>
              </li>
            }
          </ul>
        </div>
      }
    </nav>
  `,
})
export class SidebarNavComponent {
  protected readonly navigation = inject(NavigationService);

  /** Fired after a link is followed, so the mobile drawer can close. */
  readonly navigate = output();
}

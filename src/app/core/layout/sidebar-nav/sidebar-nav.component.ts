import { Component, booleanAttribute, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { TooltipDirective } from '../../../shared/ui/tooltip/tooltip.directive';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { NavigationService } from '../../navigation/navigation.service';

/**
 * Permission-filtered sidebar links (only pages the role can open; empty
 * groups are not rendered). The active link gets `aria-current="page"`;
 * nested routes (/customers/123) keep "Customers" active.
 *
 * Collapsed: icons only. The label stays in the link as screen-reader text
 * and appears, with a one-line description, in a tooltip on hover / focus;
 * group titles become thin dividers.
 */
@Component({
  selector: 'app-sidebar-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent, TooltipDirective, TranslatePipe],
  template: `
    <nav [attr.aria-label]="'ux.sidebar.navLabel' | t" class="flex flex-col" [class.gap-6]="!collapsed()" [class.gap-3]="collapsed()">
      @for (section of navigation.sections(); track section.labelKey; let first = $first) {
        <div role="group" [attr.aria-labelledby]="'nav-group-' + section.labelKey">
          @if (collapsed()) {
            @if (!first) {
              <div aria-hidden="true" class="mx-3 mb-3 h-px bg-sidebar-border"></div>
            }
            <h2 [id]="'nav-group-' + section.labelKey" class="sr-only">{{ 'navigation.sections.' + section.labelKey | t }}</h2>
          } @else {
            <h2 [id]="'nav-group-' + section.labelKey" class="px-3 pb-2 text-2xs font-semibold uppercase tracking-wider text-sidebar-foreground/65">
              {{ 'navigation.sections.' + section.labelKey | t }}
            </h2>
          }
          <ul class="flex flex-col gap-0.5">
            @for (item of section.items; track item.path) {
              <li>
                <a
                  [routerLink]="navigation.link(item.path)"
                  routerLinkActive="bg-sidebar-accent/15 font-medium !text-sidebar-foreground before:opacity-100 [&_app-icon]:text-sidebar-accent"
                  [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
                  ariaCurrentWhenActive="page"
                  [appTooltip]="collapsed() ? description(item.labelKey) : null"
                  [appTooltipHeading]="collapsed() ? ('navigation.items.' + item.labelKey | t) : null"
                  appTooltipSide="end"
                  (click)="navigate.emit()"
                  class="relative flex items-center gap-3 rounded-md py-2 text-sm text-sidebar-foreground/70 transition-[color,background-color,padding] duration-200 ease-premium hover:bg-sidebar-accent/10 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-full before:bg-sidebar-accent before:opacity-0 before:transition-opacity before:duration-200"
                  [class.px-3]="!collapsed()"
                  [class.justify-center]="collapsed()"
                  [class.px-0]="collapsed()"
                >
                  <app-icon [icon]="item.icon" svgClass="size-4 shrink-0" />
                  <span class="truncate" [class.sr-only]="collapsed()">{{ 'navigation.items.' + item.labelKey | t }}</span>
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
  private readonly i18n = inject(I18nService);

  /** Icon-only rail (desktop); the mobile drawer is always expanded. */
  readonly collapsed = input(false, { transform: booleanAttribute });

  /** Fired after a link is followed, so the mobile drawer can close. */
  readonly navigate = output();

  /** One-line purpose of a page, shown under its name in the collapsed tooltip. */
  protected description(labelKey: string): string {
    const key = `navigation.descriptions.${labelKey}`;
    return this.i18n.has(key) ? this.i18n.t(key) : '';
  }
}

import { Component, computed, effect, inject, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Clock, Search, Star } from 'lucide';
import { map, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { CommandPalette } from '../../core/command-palette/command-palette.service';
import { PaletteCommands } from '../../core/command-palette/palette-commands.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { NavigationService } from '../../core/navigation/navigation.service';
import { FavoritesService } from '../../core/records/favorites.service';
import { RecentRecords } from '../../core/records/recent-records.service';
import { RECORD_ICONS, type RecordHit } from '../../core/records/record-ref';
import { RecordsApi } from '../../core/records/records-api.service';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../shared/ui/card/card.imports';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ListSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';

const MAX_ITEMS = 5;
/** Business records a role can bookmark; without any of these the panel has nothing to offer. */
const RECORD_VIEW_PERMISSIONS = ['customers.view', 'leads.view', 'opportunities.view', 'combined_proposals.view', 'contracts.view', 'projects.view'] as const;

/**
 * "Pick up where you left off": the user's favorites and recently viewed
 * records (both resolved by the server under the user's current access, and
 * each link re-checked against the route guard) plus the create actions this
 * role may start. Not shown to roles without business records.
 */
@Component({
  selector: 'app-quick-access',
  imports: [RouterLink, TranslatePipe, ButtonDirective, IconComponent, ListSkeletonComponent, ...CARD_IMPORTS],
  template: `
    @if (visible()) {
      <section appCard aria-labelledby="quick-access-heading">
        <div appCardHeader class="flex flex-row flex-wrap items-center justify-between gap-3">
          <h2 appCardTitle id="quick-access-heading">{{ 'ux.dashboard.quickAccess' | t }}</h2>
          <button type="button" appButton variant="outline" size="sm" (click)="palette.show()">
            <app-icon [icon]="searchIcon" />
            {{ 'ux.dashboard.openPalette' | t }}
          </button>
        </div>
        <div appCardContent class="grid gap-6 md:grid-cols-3">
          <div>
            <h3 class="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <app-icon [icon]="starIcon" svgClass="size-3.5" />{{ 'ux.dashboard.favorites' | t }}
            </h3>
            @if (!favorites.loaded()) {
              <app-list-skeleton [rows]="3" />
            } @else if (favoriteHits().length) {
              <ul class="flex flex-col gap-0.5">
                @for (hit of favoriteHits(); track hit.type + hit.id) {
                  <li>
                    <a [routerLink]="link(hit)" class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <app-icon [icon]="icons[hit.type]" svgClass="size-4 shrink-0 text-muted-foreground" />
                      <span class="min-w-0 flex-1 truncate" dir="auto">{{ hit.title || hit.number }}</span>
                      @if (hit.number) {
                        <span class="tabular shrink-0 text-xs text-muted-foreground" dir="ltr">{{ hit.number }}</span>
                      }
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-sm text-muted-foreground">{{ 'ux.dashboard.emptyFavorites' | t }}</p>
            }
          </div>
          <div>
            <h3 class="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <app-icon [icon]="clockIcon" svgClass="size-3.5" />{{ 'ux.dashboard.recent' | t }}
            </h3>
            @if (recentHits.isLoading()) {
              <app-list-skeleton [rows]="3" />
            } @else if (recentList().length) {
              <ul class="flex flex-col gap-0.5">
                @for (hit of recentList(); track hit.type + hit.id) {
                  <li>
                    <a [routerLink]="link(hit)" class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <app-icon [icon]="icons[hit.type]" svgClass="size-4 shrink-0 text-muted-foreground" />
                      <span class="min-w-0 flex-1 truncate" dir="auto">{{ hit.title || hit.number }}</span>
                      <span class="shrink-0 text-xs text-muted-foreground">{{ 'search.types.' + hit.type | t }}</span>
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-sm text-muted-foreground">{{ 'ux.dashboard.emptyRecent' | t }}</p>
            }
          </div>
          @if (creates().length) {
            <div>
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ 'ux.dashboard.create' | t }}</h3>
              <div class="flex flex-wrap gap-2">
                @for (action of creates(); track action.id) {
                  <a appButton variant="outline" size="sm" [routerLink]="navigation.link(action.path!)">
                    <app-icon [icon]="action.icon" />
                    {{ action.label }}
                  </a>
                }
              </div>
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class QuickAccessComponent {
  private readonly auth = inject(AuthService);
  private readonly records = inject(RecordsApi);
  private readonly recent = inject(RecentRecords);
  private readonly commands = inject(PaletteCommands);
  protected readonly favorites = inject(FavoritesService);
  protected readonly navigation = inject(NavigationService);
  protected readonly palette = inject(CommandPalette);
  protected readonly i18n = inject(I18nService);

  protected readonly icons = RECORD_ICONS;
  protected readonly starIcon = Star;
  protected readonly clockIcon = Clock;
  protected readonly searchIcon = Search;

  protected readonly creates = this.commands.creates;
  protected readonly visible = computed(() => this.creates().length > 0 || this.auth.canAny(RECORD_VIEW_PERMISSIONS));

  /** Resolved once when the panel appears (fresh labels, current access only). */
  protected readonly recentHits = rxResource({
    params: () => (this.visible() ? untracked(() => this.recent.refs()) : undefined),
    stream: ({ params }) => (params?.length ? this.records.resolve(params).pipe(map((hits) => ({ params, hits }))) : of({ params: params ?? [], hits: [] as RecordHit[] })),
  });

  protected readonly favoriteHits = computed(() => this.favorites.hits().filter((hit) => this.navigation.canOpen(hit.route)).slice(0, MAX_ITEMS));
  protected readonly recentList = computed(() => (this.recentHits.value()?.hits ?? []).filter((hit) => this.navigation.canOpen(hit.route)).slice(0, MAX_ITEMS));

  constructor() {
    effect(() => {
      if (this.visible()) void this.favorites.load();
    });
    // Forget recently-viewed entries the server no longer resolves.
    effect(() => {
      const value = this.recentHits.value();
      if (value?.params.length) untracked(() => this.recent.retain(value.params, value.hits));
    });
  }

  protected link(hit: RecordHit): string {
    return this.navigation.link(hit.route);
  }
}

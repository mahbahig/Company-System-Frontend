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
  templateUrl: './quick-access.component.html',
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

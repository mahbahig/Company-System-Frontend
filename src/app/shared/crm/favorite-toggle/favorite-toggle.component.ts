import { Component, computed, inject, input, signal } from '@angular/core';
import { Star } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { FavoritesService } from '../../../core/records/favorites.service';
import type { RecordType } from '../../../core/records/record-ref';
import { IconComponent } from '../../ui/icon/icon.component';
import { TooltipDirective } from '../../ui/tooltip/tooltip.directive';

/**
 * Star toggle in a record page header: pin / unpin the record for the
 * command palette and the dashboard. Rendered only on pages the user could
 * open, and the server re-checks access before pinning; a favorite never
 * grants access (unreachable pins are simply not listed).
 */
@Component({
  selector: 'app-favorite-toggle',
  imports: [IconComponent, TooltipDirective],
  templateUrl: './favorite-toggle.component.html',
  host: { class: 'inline-flex' },
})
export class FavoriteToggleComponent {
  protected readonly favorites = inject(FavoritesService);
  private readonly i18n = inject(I18nService);

  readonly type = input.required<RecordType>();
  readonly id = input.required<string>();

  protected readonly star = Star;
  protected readonly error = signal<string | null>(null);
  protected readonly pinned = computed(() => this.favorites.isFavorite({ type: this.type(), id: this.id() }));
  protected readonly label = computed(() => this.i18n.t(this.pinned() ? 'ux.favorites.remove' : 'ux.favorites.add'));

  constructor() {
    void this.favorites.load();
  }

  protected async toggle(): Promise<void> {
    this.error.set(null);
    try {
      await this.favorites.toggle({ type: this.type(), id: this.id() });
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
    }
  }
}

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
  template: `
    <button
      type="button"
      class="inline-flex size-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground shadow-xs transition-[color,background-color,border-color,transform] duration-200 ease-premium hover:border-foreground/20 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:opacity-60"
      [class.!text-accent]="pinned()"
      [attr.aria-pressed]="pinned()"
      [attr.aria-label]="label()"
      [appTooltip]="label()"
      appTooltipSide="bottom"
      [disabled]="favorites.busy()"
      (click)="toggle()"
    >
      <app-icon [icon]="star" [svgClass]="pinned() ? 'size-4 fill-current' : 'size-4'" />
    </button>
    @if (error()) {
      <span role="alert" class="ms-2 self-center text-xs text-destructive">{{ error() }}</span>
    }
  `,
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

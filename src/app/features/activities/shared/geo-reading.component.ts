import { Component, inject, input } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { GeoReading } from '../activities-api.service';

/**
 * One GPS reading. Coordinates and distance are shown only when the API sent
 * them (it strips them for users without the view-locations permission), so
 * other users see just that the arrival happened and when.
 */
@Component({
  selector: 'app-geo-reading',
  imports: [TranslatePipe],
  template: `
    @if (reading(); as r) {
      <span class="tabular">{{ i18n.formatDate(r.at, true) }}</span>
      @if (r.latitude !== undefined && r.longitude !== undefined) {
        <span class="block text-xs text-muted-foreground" dir="ltr">{{ r.latitude.toFixed(5) }}, {{ r.longitude.toFixed(5) }} ± {{ r.accuracyM ?? '?' }} m</span>
      }
      @if (r.distanceM !== undefined && r.distanceM !== null) {
        <span class="block text-xs" [class.text-destructive]="r.distanceM > 500">{{ 'gps.distance' | t: { meters: i18n.formatNumber(r.distanceM) } }}</span>
      }
      @if (r.manualReason) {
        <span class="block text-xs text-muted-foreground">{{ 'gps.manualReason' | t }}: {{ r.manualReason }}</span>
      }
    } @else {
      —
    }
  `,
})
export class GeoReadingComponent {
  protected readonly i18n = inject(I18nService);
  readonly reading = input<GeoReading | null | undefined>();
}

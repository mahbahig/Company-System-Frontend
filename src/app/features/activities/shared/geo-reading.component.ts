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
  templateUrl: './geo-reading.component.html',
})
export class GeoReadingComponent {
  protected readonly i18n = inject(I18nService);
  readonly reading = input<GeoReading | null | undefined>();
}

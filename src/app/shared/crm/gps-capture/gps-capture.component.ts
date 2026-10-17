import { Component, inject, input, output, signal } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonDirective } from '../../ui/button/button.directive';
import { FORM_IMPORTS } from '../../ui/form/form.imports';

/** What a visit check-in / check-out records (backend `GeoCaptureDto`). */
export interface GeoCapture {
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  manualReason?: string;
  note?: string;
}

/**
 * Site visit GPS capture: reads the device position (location is collected
 * only at this moment — NFR-011) and shows its accuracy; when GPS is denied or
 * unavailable a manual reason is required instead. (Meetings never fall back
 * to a reason: they use `GeolocationService` and need a position.)
 */
@Component({
  selector: 'app-gps-capture',
  imports: [TranslatePipe, ButtonDirective, ...FORM_IMPORTS],
  templateUrl: './gps-capture.component.html',
})
export class GpsCaptureComponent {
  private readonly i18n = inject(I18nService);

  readonly confirmLabel = input.required<string>();
  readonly idPrefix = input('gps');
  readonly busy = input(false);
  readonly captured = output<GeoCapture>();

  protected readonly locating = signal(false);
  protected readonly failed = signal(false);
  protected readonly position = signal<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  protected readonly reason = signal('');
  protected readonly note = signal('');

  protected locate(): void {
    if (!('geolocation' in navigator)) {
      this.failed.set(true);
      return;
    }
    this.locating.set(true);
    this.failed.set(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.position.set({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        this.locating.set(false);
      },
      () => {
        this.failed.set(true);
        this.locating.set(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  protected confirm(): void {
    const pos = this.position();
    this.captured.emit({
      ...(pos ? { latitude: pos.latitude, longitude: pos.longitude, accuracyM: Math.round(pos.accuracy) } : {}),
      manualReason: this.reason().trim() || undefined,
      note: this.note().trim() || undefined,
    });
  }

  protected round(value: number): string {
    return this.i18n.formatNumber(Math.round(value));
  }
}

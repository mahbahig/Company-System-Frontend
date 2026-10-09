import { Component, inject, input, output, signal } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonDirective } from '../../ui/button/button.directive';
import { FORM_IMPORTS } from '../../ui/form/form.imports';

/** What a check-in / arrival records (backend `GeoCaptureDto`). */
export interface GeoCapture {
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  manualReason?: string;
  note?: string;
}

/**
 * VISIT / MEET GPS capture: reads the device position (location is collected
 * only at this moment — NFR-011) and shows its accuracy; when GPS is denied or
 * unavailable a manual reason is required instead.
 */
@Component({
  selector: 'app-gps-capture',
  imports: [TranslatePipe, ButtonDirective, ...FORM_IMPORTS],
  template: `
    <div class="flex flex-col gap-3">
      <button type="button" appButton variant="outline" [disabled]="locating() || busy()" (click)="locate()">{{ (locating() ? 'gps.locating' : 'gps.capture') | t }}</button>
      @if (position(); as pos) {
        <p class="text-sm" role="status">
          {{ 'gps.captured' | t }} <span class="tabular" dir="ltr">{{ pos.latitude.toFixed(5) }}, {{ pos.longitude.toFixed(5) }}</span>
          · {{ 'gps.accuracy' | t: { meters: round(pos.accuracy) } }}
        </p>
      }
      @if (failed()) {
        <p class="text-sm text-destructive" role="alert">{{ 'gps.unavailable' | t }}</p>
      }
      <div>
        <label appLabel [for]="idPrefix() + '-reason'" [required]="!position()">{{ 'gps.manualReason' | t }}</label>
        <input appInput [id]="idPrefix() + '-reason'" [value]="reason()" (input)="reason.set($any($event.target).value)" />
      </div>
      <div>
        <label appLabel [for]="idPrefix() + '-note'">{{ 'gps.note' | t }}</label>
        <input appInput [id]="idPrefix() + '-note'" [value]="note()" (input)="note.set($any($event.target).value)" />
      </div>
      <button type="button" appButton [disabled]="busy() || (!position() && !reason().trim())" (click)="confirm()">{{ confirmLabel() }}</button>
    </div>
  `,
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

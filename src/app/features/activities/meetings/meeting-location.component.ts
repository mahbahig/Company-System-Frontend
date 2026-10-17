import { Component, computed, inject, input } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { LatLngLiteral } from '../../../core/maps/google-maps.types';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import type { GeoReading, Meeting } from '../activities-api.service';
import { MeetingLocationMapComponent } from './meeting-location-map.component';

/** What the verification panel says (from the API's verdict; nothing is decided here). */
type Verdict = 'verified' | 'changed' | 'unreliable' | 'in-progress' | 'unavailable' | 'not-started';

/**
 * A meeting's location verification: when its start and end were captured
 * (with their accuracy), the distance between them and the server's verdict
 * against the allowed radius — and, for whoever the API sends coordinates to
 * (`meetings.view_locations`), both positions on one map. Meetings from
 * before verification simply say it is unavailable.
 */
@Component({
  selector: 'app-meeting-location',
  imports: [TranslatePipe, AlertComponent, MeetingLocationMapComponent, ...CARD_IMPORTS],
  template: `
    <section appCard aria-labelledby="mt-location">
      <div appCardHeader>
        <h2 appCardTitle id="mt-location">{{ 'act.meetings.location.title' | t }}</h2>
      </div>
      <div appCardContent class="flex flex-col gap-4">
        <dl class="grid gap-4 sm:grid-cols-3">
          @for (point of points(); track point.key) {
            <div>
              <dt class="text-xs font-medium text-muted-foreground">{{ point.label | t }}</dt>
              <dd class="mt-1 text-sm" [attr.data-testid]="'location-' + point.key">
                @if (point.reading; as reading) {
                  <span class="block">{{ 'act.meetings.location.captured' | t: { at: i18n.formatDate(reading.at, true) } }}</span>
                  @if (reading.accuracyM !== undefined && reading.accuracyM !== null) {
                    <span class="block text-xs text-muted-foreground tabular">{{ 'act.meetings.location.accuracy' | t: { metres: i18n.formatNumber(reading.accuracyM) } }}</span>
                  }
                } @else {
                  <span class="text-muted-foreground">—</span>
                }
              </dd>
            </div>
          }
          <div>
            <dt class="text-xs font-medium text-muted-foreground">{{ 'act.meetings.location.distance' | t }}</dt>
            <dd class="mt-1 text-sm tabular" data-testid="location-distance">
              @if (distance() !== null) {
                {{ 'act.meetings.location.metres' | t: { metres: i18n.formatNumber(distance()!, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) } }}
              } @else {
                <span class="text-muted-foreground">—</span>
              }
            </dd>
          </div>
        </dl>

        @switch (verdict()) {
          @case ('verified') {
            <app-alert variant="success" data-testid="location-verdict" data-verdict="verified">
              <p class="font-semibold">✓ {{ 'act.meetings.location.verified' | t }}</p>
              <p class="mt-1">{{ 'act.meetings.location.verifiedBody' | t: { radius: radius() } }}</p>
            </app-alert>
          }
          @case ('changed') {
            <app-alert variant="warning" data-testid="location-verdict" data-verdict="changed">
              <p class="font-semibold">⚠ {{ 'act.meetings.location.changed' | t }}</p>
              <p class="mt-1">{{ 'act.meetings.location.changedBody' | t: { metres: i18n.formatNumber(distance() ?? 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) } }}</p>
              <p class="mt-1">{{ 'act.meetings.location.allowedRadius' | t: { radius: radius() } }}</p>
            </app-alert>
          }
          @case ('unreliable') {
            <app-alert variant="warning" data-testid="location-verdict" data-verdict="unreliable">
              <p class="font-semibold">⚠ {{ 'act.meetings.location.unreliable' | t }}</p>
              <p class="mt-1">{{ 'act.meetings.location.unreliableBody' | t: { radius: radius() } }}</p>
            </app-alert>
          }
          @case ('in-progress') {
            <p class="text-sm text-muted-foreground" data-testid="location-verdict" data-verdict="in-progress">{{ 'act.meetings.location.inProgress' | t }}</p>
          }
          @case ('unavailable') {
            <p class="text-sm text-muted-foreground" data-testid="location-verdict" data-verdict="unavailable">{{ 'act.meetings.location.unavailable' | t }}</p>
          }
          @default {
            <p class="text-sm text-muted-foreground" data-testid="location-verdict" data-verdict="not-started">{{ 'act.meetings.location.notStarted' | t }}</p>
          }
        }

        @if (startPoint(); as start) {
          <app-meeting-location-map [start]="start" [end]="endPoint()" [radiusM]="radiusM()" [within]="within()" />
        }
      </div>
    </section>
  `,
})
export class MeetingLocationComponent {
  protected readonly i18n = inject(I18nService);

  readonly meeting = input.required<Meeting>();

  protected readonly points = computed(() => [
    { key: 'start', label: 'act.meetings.location.start', reading: this.meeting().arrival ?? null },
    { key: 'end', label: 'act.meetings.location.end', reading: this.meeting().departure ?? null },
  ]);
  protected readonly distance = computed(() => numberOrNull(this.meeting().locationDistanceM));
  /** The radius this meeting is verified against (stored when it started), else the default. */
  protected readonly radiusM = computed(() => numberOrNull(this.meeting().locationRadiusM) ?? 50);
  protected readonly radius = computed(() => this.i18n.formatNumber(this.radiusM()));
  protected readonly verdict = computed<Verdict>(() => {
    const meeting = this.meeting();
    switch (meeting.locationVerificationStatus) {
      case 'within_radius':
        return 'verified';
      case 'outside_radius':
        return 'changed';
      case 'location_unreliable':
        return 'unreliable';
    }
    if (meeting.arrival && !meeting.departure) return pointOf(meeting.arrival) || meeting.locationRadiusM ? 'in-progress' : 'unavailable';
    return meeting.departure ? 'unavailable' : 'not-started';
  });
  protected readonly within = computed(() => {
    const status = this.meeting().locationVerificationStatus;
    return status === 'within_radius' ? true : status === 'outside_radius' ? false : null;
  });
  /** Coordinates arrive only for callers with `meetings.view_locations`: no coordinates, no map. */
  protected readonly startPoint = computed(() => pointOf(this.meeting().arrival));
  protected readonly endPoint = computed(() => pointOf(this.meeting().departure));
}

function pointOf(reading: GeoReading | null | undefined): LatLngLiteral | null {
  return typeof reading?.latitude === 'number' && typeof reading.longitude === 'number' && Number.isFinite(reading.latitude) && Number.isFinite(reading.longitude)
    ? { lat: reading.latitude, lng: reading.longitude }
    : null;
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

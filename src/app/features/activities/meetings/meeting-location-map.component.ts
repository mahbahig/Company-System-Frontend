import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { GoogleMapsLoader } from '../../../core/maps/google-maps-loader.service';
import type { GoogleMap, GoogleMarker, GoogleOverlay, LatLngLiteral } from '../../../core/maps/google-maps.types';

/** Map colours: start / inside the radius = green, end = red (the legend repeats them in words). */
const START_COLOUR = '#16a34a';
const END_COLOUR = '#dc2626';
const FIT_PADDING_PX = 40;

type MapState = 'loading' | 'ready' | 'not-configured' | 'failed';

/**
 * A meeting's start and end positions on one Google Map: the start (green),
 * the end (red), the allowed radius drawn around the start and a line from
 * start to end — fitted so all of it is in view, from the stored coordinates
 * only. Visualization only: the distance and the verdict come from the API.
 */
@Component({
  selector: 'app-meeting-location-map',
  imports: [TranslatePipe],
  template: `
    <div class="relative overflow-hidden rounded-md border border-border bg-secondary/40">
      <div #canvas class="h-72 w-full" role="img" [attr.aria-label]="description()" data-testid="meeting-map"></div>
      @if (state() !== 'ready') {
        <p class="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground" data-testid="meeting-map-state">
          {{ 'act.meetings.location.map.' + state() | t }}
        </p>
      }
    </div>
    <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li class="flex items-center gap-1.5"><span class="size-2.5 rounded-full" [style.background]="startColour"></span>{{ 'act.meetings.location.map.startMarker' | t }}</li>
      @if (end()) {
        <li class="flex items-center gap-1.5"><span class="size-2.5 rounded-full" [style.background]="endColour"></span>{{ 'act.meetings.location.map.endMarker' | t }}</li>
      }
      <li class="flex items-center gap-1.5">
        <span class="size-2.5 rounded-full border-2" [style.border-color]="startColour"></span>{{ 'act.meetings.location.map.radius' | t: { radius: i18n.formatNumber(radiusM()) } }}
      </li>
    </ul>
  `,
})
export class MeetingLocationMapComponent {
  private readonly loader = inject(GoogleMapsLoader);
  protected readonly i18n = inject(I18nService);
  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');

  readonly start = input.required<LatLngLiteral>();
  readonly end = input<LatLngLiteral | null>(null);
  readonly radiusM = input.required<number>();
  /** The API's verdict: the end inside the radius (null while the meeting is in progress or without a verdict). */
  readonly within = input<boolean | null>(null);

  protected readonly startColour = START_COLOUR;
  protected readonly endColour = END_COLOUR;
  protected readonly state = signal<MapState>('loading');
  protected readonly description = computed(() => {
    const radius = this.i18n.formatNumber(this.radiusM());
    const within = this.within();
    const verdict = within === null ? '' : this.i18n.t(within ? 'act.meetings.location.map.within' : 'act.meetings.location.map.outside', { radius });
    return `${this.i18n.t('act.meetings.location.map.label', { radius })} ${verdict}`.trim();
  });

  private drawn: Array<GoogleOverlay | GoogleMarker> = [];
  private map: GoogleMap | null = null;
  private rendered = false;

  constructor() {
    afterNextRender(() => {
      this.rendered = true;
      void this.draw();
    });
    // New positions (the meeting just ended): drawn again.
    effect(() => {
      this.start();
      this.end();
      this.radiusM();
      untracked(() => {
        if (this.rendered) void this.draw();
      });
    });
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  private async draw(): Promise<void> {
    let loaded;
    try {
      loaded = await this.loader.load();
    } catch {
      this.state.set('failed');
      return;
    }
    if (!loaded) {
      this.state.set('not-configured');
      return;
    }
    const { api, mapId } = loaded;
    const start = this.start();
    const end = this.end();
    this.clear();
    this.map ??= new api.Map(this.canvas().nativeElement, { mapId, center: start, zoom: 18, streetViewControl: false, mapTypeControl: false, fullscreenControl: true });
    const map = this.map;
    const circle = new api.Circle({ map, center: start, radius: this.radiusM(), strokeColor: START_COLOUR, strokeOpacity: 0.9, strokeWeight: 2, fillColor: START_COLOUR, fillOpacity: 0.12, clickable: false });
    const pin = (background: string, glyph: string) => new api.PinElement({ background, borderColor: '#ffffff', glyphColor: '#ffffff', glyph }).element;
    this.drawn = [circle, new api.AdvancedMarkerElement({ map, position: start, content: pin(START_COLOUR, 'S'), title: this.i18n.t('act.meetings.location.map.startMarker') })];
    const bounds = new api.LatLngBounds().extend(start);
    const circleBounds = circle.getBounds();
    if (circleBounds) bounds.union(circleBounds);
    if (end) {
      this.drawn.push(
        new api.AdvancedMarkerElement({ map, position: end, content: pin(END_COLOUR, 'E'), title: this.i18n.t('act.meetings.location.map.endMarker') }),
        new api.Polyline({ map, path: [start, end], strokeColor: END_COLOUR, strokeOpacity: 0.85, strokeWeight: 3, clickable: false }),
      );
      bounds.extend(end);
    }
    map.fitBounds(bounds, FIT_PADDING_PX);
    this.state.set('ready');
  }

  private clear(): void {
    for (const item of this.drawn) {
      if ('setMap' in item) item.setMap(null);
      else item.map = null;
    }
    this.drawn = [];
  }
}

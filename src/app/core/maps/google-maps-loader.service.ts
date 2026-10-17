import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../api/api.service';
import type { GoogleMapsApi, LoadedGoogleMaps } from './google-maps.types';

/** Where the browser key lives: server configuration (`GOOGLE_MAPS_API_KEY`), never this code. */
interface MapsConfig {
  apiKey: string | null;
  mapId: string;
}

interface GoogleNamespace {
  maps: { importLibrary(name: string): Promise<Record<string, unknown>> };
}

const SCRIPT_URL = 'https://maps.googleapis.com/maps/api/js';
const READY_CALLBACK = '__ecotechGoogleMapsReady';

/**
 * Loads the Google Maps JavaScript API once per page, with the key the API
 * gives to people who may see recorded locations (`GET /maps/config`).
 * Resolves null when maps are not configured. Visualization only: nothing is
 * calculated with it.
 */
@Service()
export class GoogleMapsLoader {
  private readonly api = inject(ApiService);
  private readonly document = inject(DOCUMENT);
  private loading: Promise<LoadedGoogleMaps | null> | null = null;

  load(): Promise<LoadedGoogleMaps | null> {
    this.loading ??= this.start().catch((error: unknown) => {
      // A failed load may be retried (the next map asks again).
      this.loading = null;
      throw error;
    });
    return this.loading;
  }

  private async start(): Promise<LoadedGoogleMaps | null> {
    const config = await firstValueFrom(this.api.get<MapsConfig>('maps/config'));
    if (!config.apiKey) return null;
    const google = await this.script(config.apiKey);
    // core: LatLngBounds; maps: Map, Circle, Polyline; marker: AdvancedMarkerElement, PinElement.
    const [core, maps, marker] = await Promise.all(['core', 'maps', 'marker'].map((name) => google.maps.importLibrary(name)));
    return { api: { ...core, ...maps, ...marker } as unknown as GoogleMapsApi, mapId: config.mapId };
  }

  private script(apiKey: string): Promise<GoogleNamespace> {
    const window = this.document.defaultView as (Window & { google?: GoogleNamespace; [READY_CALLBACK]?: () => void }) | null;
    if (!window) return Promise.reject(new Error('no window'));
    if (window.google?.maps) return Promise.resolve(window.google);
    return new Promise((resolve, reject) => {
      window[READY_CALLBACK] = () => (window.google ? resolve(window.google) : reject(new Error('Google Maps did not load')));
      const script = this.document.createElement('script');
      script.src = `${SCRIPT_URL}?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${READY_CALLBACK}`;
      script.async = true;
      script.onerror = () => reject(new Error('Google Maps could not be loaded'));
      this.document.head.appendChild(script);
    });
  }
}

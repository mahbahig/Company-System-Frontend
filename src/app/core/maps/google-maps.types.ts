/**
 * The small part of the Google Maps JavaScript API the app draws with
 * (maps, a circle, a line, two markers) — typed here instead of pulling in the
 * whole type package.
 */
export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface GoogleMap {
  fitBounds(bounds: GoogleLatLngBounds, padding?: number): void;
}

export interface GoogleLatLngBounds {
  extend(point: LatLngLiteral): GoogleLatLngBounds;
  union(other: GoogleLatLngBounds): GoogleLatLngBounds;
}

export interface GoogleOverlay {
  setMap(map: GoogleMap | null): void;
}

export interface GoogleCircle extends GoogleOverlay {
  getBounds(): GoogleLatLngBounds | null;
}

export interface GoogleMarker {
  map: GoogleMap | null;
}

export interface GoogleMapsApi {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
  Circle: new (options: Record<string, unknown>) => GoogleCircle;
  Polyline: new (options: Record<string, unknown>) => GoogleOverlay;
  LatLngBounds: new () => GoogleLatLngBounds;
  AdvancedMarkerElement: new (options: Record<string, unknown>) => GoogleMarker;
  PinElement: new (options: Record<string, unknown>) => { element: HTMLElement };
}

/** A loaded API and the map id its markers use. */
export interface LoadedGoogleMaps {
  api: GoogleMapsApi;
  mapId: string;
}

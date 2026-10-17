import { InjectionToken, Service, inject } from '@angular/core';

/** Why a position could not be read (each has its own message; the browser's own text is never shown). */
export type GeolocationFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

/** One device position: coordinates and the accuracy the device reported, metres. */
export interface DeviceFix {
  latitude: number;
  longitude: number;
  accuracyM: number;
}

export class GeolocationError extends Error {
  constructor(readonly reason: GeolocationFailure) {
    super(`geolocation ${reason}`);
  }
}

/** The browser's Geolocation API (null where there is none); replaced in tests. */
export const GEOLOCATION = new InjectionToken<Geolocation | null>('GEOLOCATION', {
  providedIn: 'root',
  factory: () => (typeof navigator !== 'undefined' && 'geolocation' in navigator ? navigator.geolocation : null),
});

/**
 * A fresh, high-accuracy reading — never a cached position (`maximumAge: 0`),
 * and given up after this long.
 */
export const POSITION_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 };

/**
 * Reads the device position once, when asked (starting or ending a meeting):
 * `getCurrentPosition` only — never `watchPosition`, nothing in the
 * background, nothing kept between calls.
 */
@Service()
export class GeolocationService {
  private readonly geolocation = inject(GEOLOCATION);

  current(): Promise<DeviceFix> {
    const geolocation = this.geolocation;
    if (!geolocation) return Promise.reject(new GeolocationError('unsupported'));
    return new Promise((resolve, reject) =>
      geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          if (![latitude, longitude, accuracy].every(Number.isFinite)) return reject(new GeolocationError('unavailable'));
          resolve({ latitude, longitude, accuracyM: Math.round(accuracy * 10) / 10 });
        },
        (error) => reject(new GeolocationError(error.code === error.PERMISSION_DENIED ? 'denied' : error.code === error.TIMEOUT ? 'timeout' : 'unavailable')),
        POSITION_OPTIONS,
      ),
    );
  }
}

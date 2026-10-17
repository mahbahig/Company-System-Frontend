import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { userWithRoles } from '../../../../testing/as-role';
import { AuthService } from '../../../core/auth/auth.service';
import { GEOLOCATION, GeolocationError, GeolocationService, POSITION_OPTIONS } from '../../../core/geo/geolocation.service';
import { GoogleMapsLoader } from '../../../core/maps/google-maps-loader.service';
import { ActivitiesApi, type Meeting } from '../activities-api.service';
import { MeetingDetailPage } from './meeting-detail.page';
import { MeetingLocationComponent } from './meeting-location.component';
import { MeetingLocationMapComponent } from './meeting-location-map.component';

const tick = () => new Promise((resolve) => setTimeout(resolve));
const OWNER = 'u-sales_representative';

/** A fake Geolocation API: each call answers what the test queued (a position or an error code). */
class FakeGeolocation {
  readonly calls: PositionOptions[] = [];
  watchPosition = vi.fn();
  private pending: Array<(success: PositionCallback, failure: PositionErrorCallback) => void> = [];

  succeed(latitude: number, longitude: number, accuracy: number): void {
    this.pending.push((success) => success({ coords: { latitude, longitude, accuracy } } as GeolocationPosition));
  }

  fail(code: 1 | 2 | 3): void {
    this.pending.push((_success, failure) => failure({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: 'raw browser text' } as GeolocationPositionError));
  }

  /** Leaves the next request unanswered until `release()` (a slow fix). */
  hold(): () => void {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    this.pending.push((success) => void gate.then(() => success({ coords: { latitude: 30, longitude: 31, accuracy: 9 } } as GeolocationPosition)));
    return release;
  }

  getCurrentPosition(success: PositionCallback, failure: PositionErrorCallback, options: PositionOptions): void {
    this.calls.push(options);
    const next = this.pending.shift();
    if (next) next(success, failure);
  }
}

function meeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'm1',
    subject: 'Site walkthrough',
    customerId: { id: 'c1', nameEn: 'Acme' },
    ownerId: { id: OWNER, fullNameAr: 'م', fullNameEn: 'Rep' } as never,
    scheduledAt: '2026-10-17T09:00:00.000Z',
    mode: 'in_person',
    attendees: [],
    status: 'planned',
    arrival: null,
    departure: null,
    ...overrides,
  };
}

describe('GeolocationService — one fresh reading, each failure named', () => {
  function setup(geolocation: FakeGeolocation | null) {
    TestBed.configureTestingModule({ providers: [{ provide: GEOLOCATION, useValue: geolocation }] });
    return TestBed.inject(GeolocationService);
  }

  it('reads once with high accuracy, a timeout and no cached position; never watches', async () => {
    const fake = new FakeGeolocation();
    fake.succeed(31.2001, 29.9187, 8.44);
    await expect(setup(fake).current()).resolves.toEqual({ latitude: 31.2001, longitude: 29.9187, accuracyM: 8.4 });
    expect(fake.calls).toEqual([POSITION_OPTIONS]);
    expect(POSITION_OPTIONS).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });
    expect(POSITION_OPTIONS.timeout).toBeGreaterThan(0);
    expect(fake.watchPosition).not.toHaveBeenCalled();
  });

  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ] as const)('error code %s → %s', async (code, reason) => {
    const fake = new FakeGeolocation();
    fake.fail(code);
    await expect(setup(fake).current()).rejects.toMatchObject({ reason });
  });

  it('no Geolocation API → unsupported', async () => {
    await expect(setup(null).current()).rejects.toEqual(new GeolocationError('unsupported'));
  });
});

describe('Meeting page — start and end capture a fresh location (or say why not)', () => {
  let geolocation: FakeGeolocation;
  let current: ReturnType<typeof signal<Meeting>>;
  let arrive: ReturnType<typeof vi.fn>;
  let depart: ReturnType<typeof vi.fn>;

  async function render(initial: Meeting, role: Parameters<typeof userWithRoles>[0] = 'sales_representative') {
    geolocation = new FakeGeolocation();
    current = signal(initial);
    arrive = vi.fn((_id: string, position: object) => {
      current.set({ ...current(), status: 'confirmed', arrival: { at: '2026-10-17T09:05:00.000Z' }, locationRadiusM: 50 });
      return of({ ...current(), position });
    });
    depart = vi.fn(() => {
      current.set({ ...current(), status: 'completed', departure: { at: '2026-10-17T10:05:00.000Z' }, locationDistanceM: 12.3, locationVerificationStatus: 'within_radius' });
      return of(current());
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GEOLOCATION, useValue: geolocation },
        { provide: GoogleMapsLoader, useValue: { load: () => Promise.resolve(null) } },
        { provide: ActivitiesApi, useValue: { meeting: () => of(current()), arrive, depart, updateMeeting: vi.fn(), cancelMeeting: vi.fn() } },
      ],
    });
    TestBed.inject(AuthService).user.set(userWithRoles(role));
    const fixture = TestBed.createComponent(MeetingDetailPage);
    fixture.componentRef.setInput('id', 'm1');
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = (kind: 'start' | 'end') => root.querySelector<HTMLButtonElement>(`[data-testid="${kind}-meeting"]`);
    const settle = async () => {
      for (let i = 0; i < 4; i += 1) {
        await tick();
        fixture.detectChanges();
      }
    };
    return { fixture, root, button, settle };
  }

  it('Start says the location will be recorded; it reads the position, sends ONLY coordinates + accuracy, and the meeting starts', async () => {
    const view = await render(meeting());
    expect(view.root.textContent).toContain('act.meetings.startHint');
    geolocation.succeed(31.2001, 29.9187, 8);
    view.button('start')!.click();
    await view.settle();
    expect(arrive).toHaveBeenCalledTimes(1);
    expect(arrive.mock.calls[0]![1]).toEqual({ latitude: 31.2001, longitude: 29.9187, accuracyM: 8 });
    // Started: the End card replaces Start.
    expect(view.button('start')).toBeNull();
    expect(view.button('end')).not.toBeNull();
  });

  it('while the position is being read: "Getting your location…", the button disabled, a second click does nothing', async () => {
    const view = await render(meeting());
    const release = geolocation.hold();
    view.button('start')!.click();
    view.fixture.detectChanges();
    expect(view.button('start')!.disabled).toBe(true);
    expect(view.button('start')!.textContent).toContain('act.meetings.gettingLocation');
    view.button('start')!.click();
    view.button('start')!.dispatchEvent(new Event('click'));
    release();
    await view.settle();
    expect(geolocation.calls).toHaveLength(1);
    expect(arrive).toHaveBeenCalledTimes(1);
  });

  it.each([
    [1 as const, 'act.meetings.location.errors.denied'],
    [3 as const, 'act.meetings.location.errors.timeout'],
    [2 as const, 'act.meetings.location.errors.unavailable'],
  ])('a position that cannot be read (code %s): a clear message, nothing sent, the meeting not started', async (code, message) => {
    const view = await render(meeting());
    geolocation.fail(code);
    view.button('start')!.click();
    await view.settle();
    expect(view.root.querySelector('[data-testid="location-error"]')?.textContent?.trim()).toBe(message);
    expect(view.root.textContent).not.toContain('raw browser text');
    expect(arrive).not.toHaveBeenCalled();
    expect(view.button('start')!.disabled).toBe(false);
  });

  it('End reads a NEW position (never the start one) and only then ends the meeting', async () => {
    const view = await render(meeting({ status: 'confirmed', arrival: { at: '2026-10-17T09:05:00.000Z' }, locationRadiusM: 50 }));
    expect(view.root.textContent).toContain('act.meetings.endHint');
    geolocation.succeed(31.2002, 29.9188, 11);
    view.button('end')!.click();
    await view.settle();
    expect(geolocation.calls).toHaveLength(1);
    expect(depart.mock.calls[0]![1]).toEqual({ latitude: 31.2002, longitude: 29.9188, accuracyM: 11 });
    expect(view.button('end')).toBeNull();
    expect(view.root.querySelector('[data-verdict="verified"]')).not.toBeNull();
  });

  it('a failed end leaves the meeting running', async () => {
    const view = await render(meeting({ status: 'confirmed', arrival: { at: '2026-10-17T09:05:00.000Z' }, locationRadiusM: 50 }));
    geolocation.fail(1);
    view.button('end')!.click();
    await view.settle();
    expect(depart).not.toHaveBeenCalled();
    expect(view.button('end')).not.toBeNull();
  });

  it('someone who is not the owner gets no Start / End (the API refuses them anyway)', async () => {
    const view = await render(meeting({ ownerId: { id: 'u-other', fullNameAr: 'x', fullNameEn: 'Other' } as never }), 'sales_manager');
    expect(view.button('start')).toBeNull();
  });
});

@Component({
  selector: 'app-location-host',
  imports: [MeetingLocationComponent],
  template: `<app-meeting-location [meeting]="meeting()" />`,
})
class LocationHost {
  readonly meeting = signal(meeting());
}

describe('Location section — the API\'s verdict, nothing computed here', () => {
  async function render(value: Meeting) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: GoogleMapsLoader, useValue: { load: () => Promise.resolve(null) } }] });
    const fixture = TestBed.createComponent(LocationHost);
    fixture.componentInstance.meeting.set(value);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return { root, verdict: () => root.querySelector('[data-testid="location-verdict"]')?.getAttribute('data-verdict'), map: () => root.querySelector('app-meeting-location-map') };
  }
  const ended = (overrides: Partial<Meeting>) =>
    meeting({ status: 'completed', arrival: { at: '2026-10-17T09:05:00.000Z', accuracyM: 8 }, departure: { at: '2026-10-17T10:05:00.000Z', accuracyM: 12 }, locationRadiusM: 50, ...overrides });

  it('within 50 m: "Location verified"; the distance and both accuracies shown', async () => {
    const view = await render(ended({ locationDistanceM: 12.34, locationVerificationStatus: 'within_radius' }));
    expect(view.verdict()).toBe('verified');
    expect(view.root.querySelector('[data-testid="location-distance"]')?.textContent).toContain('act.meetings.location.metres');
    expect(view.root.querySelector('[data-testid="location-start"]')?.textContent).toContain('act.meetings.location.accuracy');
  });

  it('outside 50 m: "Location changed" with the allowed radius; unreliable GPS: its own warning', async () => {
    expect((await render(ended({ locationDistanceM: 75.2, locationVerificationStatus: 'outside_radius' }))).verdict()).toBe('changed');
    TestBed.resetTestingModule();
    expect((await render(ended({ locationDistanceM: 10, locationVerificationStatus: 'location_unreliable' }))).verdict()).toBe('unreliable');
  });

  it('a meeting from before verification: "unavailable" — no NaN, no map, no crash', async () => {
    const view = await render(meeting({ status: 'completed', arrival: { at: '2026-10-01T09:00:00.000Z', manualReason: 'GPS unavailable' }, departure: { at: '2026-10-01T10:00:00.000Z' } }));
    expect(view.verdict()).toBe('unavailable');
    expect(view.root.textContent).not.toContain('NaN');
    expect(view.root.querySelector('[data-testid="location-distance"]')?.textContent?.trim()).toBe('—');
    expect(view.map()).toBeNull();
  });

  it('not started / in progress', async () => {
    expect((await render(meeting())).verdict()).toBe('not-started');
    TestBed.resetTestingModule();
    expect((await render(meeting({ status: 'confirmed', arrival: { at: '2026-10-17T09:05:00.000Z' }, locationRadiusM: 50 }))).verdict()).toBe('in-progress');
  });

  it('the map appears only when the API sent coordinates (meetings.view_locations)', async () => {
    const view = await render(ended({ locationDistanceM: 12, locationVerificationStatus: 'within_radius', arrival: { at: '2026-10-17T09:05:00.000Z', latitude: 31.2, longitude: 29.9, accuracyM: 8 }, departure: { at: '2026-10-17T10:05:00.000Z', latitude: 31.2001, longitude: 29.9, accuracyM: 12 } }));
    expect(view.map()).not.toBeNull();
  });
});

@Component({
  selector: 'app-map-host',
  imports: [MeetingLocationMapComponent],
  template: `<app-meeting-location-map [start]="start" [end]="end" [radiusM]="50" [within]="false" />`,
})
class MapHost {
  readonly start = { lat: 31.2001, lng: 29.9187 };
  readonly end = { lat: 31.20055, lng: 29.9192 };
}

describe('Map — start, end, the 50 m radius around the start and the line, fitted to view', () => {
  it('draws exactly that from the stored coordinates', async () => {
    const created: Record<string, Array<Record<string, unknown>>> = { circle: [], marker: [], polyline: [], pin: [] };
    const extended: unknown[] = [];
    const fitBounds = vi.fn();
    const bounds = { extend: (point: unknown) => (extended.push(point), bounds), union: () => bounds };
    const mapOptions: Array<Record<string, unknown>> = [];
    // Constructors, like the real API (`new google.maps.Circle(...)`).
    const api = {
      Map: class {
        fitBounds = fitBounds;
        constructor(element: HTMLElement, options: Record<string, unknown>) {
          mapOptions.push({ element, ...options });
        }
      },
      Circle: class {
        constructor(options: Record<string, unknown>) {
          created['circle']!.push(options);
        }
        setMap = vi.fn();
        getBounds = () => bounds;
      },
      Polyline: class {
        constructor(options: Record<string, unknown>) {
          created['polyline']!.push(options);
        }
        setMap = vi.fn();
      },
      LatLngBounds: class {
        constructor() {
          return bounds;
        }
      },
      AdvancedMarkerElement: class {
        map: unknown;
        constructor(options: Record<string, unknown>) {
          created['marker']!.push(options);
          this.map = options['map'];
        }
      },
      PinElement: class {
        element = document.createElement('div');
        constructor(options: Record<string, unknown>) {
          created['pin']!.push(options);
        }
      },
    };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: GoogleMapsLoader, useValue: { load: () => Promise.resolve({ api, mapId: 'test-map' }) } }] });
    const fixture = TestBed.createComponent(MapHost);
    fixture.detectChanges();
    await tick();
    await tick();
    fixture.detectChanges();
    expect(created['circle']).toEqual([expect.objectContaining({ center: { lat: 31.2001, lng: 29.9187 }, radius: 50 })]);
    expect(created['marker']!.map((marker) => marker['position'])).toEqual([
      { lat: 31.2001, lng: 29.9187 },
      { lat: 31.20055, lng: 29.9192 },
    ]);
    expect(created['pin']!.map((pin) => pin['background'])).toEqual(['#16a34a', '#dc2626']);
    expect(created['polyline']).toEqual([expect.objectContaining({ path: [{ lat: 31.2001, lng: 29.9187 }, { lat: 31.20055, lng: 29.9192 }] })]);
    expect(extended).toEqual(expect.arrayContaining([{ lat: 31.2001, lng: 29.9187 }, { lat: 31.20055, lng: 29.9192 }]));
    expect(fitBounds).toHaveBeenCalledTimes(1);
    expect(mapOptions).toEqual([expect.objectContaining({ element: expect.any(HTMLElement), mapId: 'test-map' })]);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="meeting-map"]')?.getAttribute('aria-label')).toContain('act.meetings.location.map.outside');
  });

  it('Google Maps not configured: says so instead of a blank box', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: GoogleMapsLoader, useValue: { load: () => Promise.resolve(null) } }] });
    const fixture = TestBed.createComponent(MapHost);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="meeting-map-state"]')?.textContent?.trim()).toBe('act.meetings.location.map.not-configured');
  });
});

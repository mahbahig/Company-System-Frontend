import { DestroyRef, Service, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

/** How often the maintenance screen asks whether Ecotech is back. */
const POLL_MS = 30_000;

/** The API's maintenance answers (503): on any request, and at sign-in. */
export const MAINTENANCE_MESSAGES: ReadonlySet<string> = new Set(['errors.maintenance', 'auth.errors.maintenance']);

/**
 * Maintenance mode in the browser. The API enforces it (503 to everyone but
 * Super Administrators); this only shows it:
 *
 * - `active` — the maintenance screen, entered when the API answers with the
 *   maintenance message; it asks the public availability check every
 *   {@link POLL_MS} and reloads the page once maintenance is over (the
 *   session was kept, so the user carries on);
 * - `administratorNotice` — a Super Administrator keeps working; a banner
 *   reminds them that everyone else sees the maintenance screen.
 */
@Service()
export class MaintenanceService {
  private readonly http = inject(HttpClient);
  readonly active = signal(false);
  readonly administratorNotice = signal(false);
  readonly checking = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  /** The API said "maintenance": show the screen and start checking for the end. */
  enter(): void {
    if (this.active()) return;
    this.active.set(true);
    this.timer = setInterval(() => void this.checkNow(), POLL_MS);
  }

  /** "Try again" (and the poll): back to the application once maintenance is over. */
  async checkNow(): Promise<boolean> {
    if (this.checking()) return false;
    this.checking.set(true);
    try {
      const inMaintenance = await this.inMaintenance();
      if (!inMaintenance && this.active()) {
        this.stopPolling();
        this.active.set(false);
        this.reloadPage();
      }
      return !inMaintenance;
    } catch {
      return false;
    } finally {
      this.checking.set(false);
    }
  }

  /** For a Super Administrator's banner: whether maintenance is on (asked once per page load, and after each switch). */
  async refreshAdministratorNotice(): Promise<void> {
    try {
      this.administratorNotice.set(await this.inMaintenance());
    } catch {
      // The banner is a reminder only — never an error for the administrator.
    }
  }

  /** Back to the application: the page loads again with the session that was kept. */
  reloadPage(): void {
    globalThis.location?.reload();
  }

  setActiveForAdministrator(enabled: boolean): void {
    this.administratorNotice.set(enabled);
  }

  private async inMaintenance(): Promise<boolean> {
    const body = await firstValueFrom(this.http.get<{ maintenance?: boolean; data?: { maintenance?: boolean } }>(`${environment.apiBaseUrl}/system/availability`));
    return !!(body.maintenance ?? body.data?.maintenance);
  }

  private stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

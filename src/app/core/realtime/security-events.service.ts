import { Service, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { ToastService } from '../../shared/ui/toast/toast.service';
import { AuthService } from '../auth/auth.service';
import { forceLogoutNotice } from '../auth/session-end';
import { SessionExpiry } from '../auth/session-expiry.service';
import { isSuperAdministrator } from '../auth/super-administrator';
import { I18nService } from '../i18n/i18n.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from './realtime.service';
import { SystemLockChanges, type SystemLockEvent } from './system-lock-changes.service';

export const FORCE_LOGOUT = 'FORCE_LOGOUT';
export const SYSTEM_LOCKED = 'SYSTEM_LOCKED';
export const SYSTEM_UNLOCKED = 'SYSTEM_UNLOCKED';

/**
 * What this browser does when the server says a session is over or the
 * system was locked (Socket.IO). The server has already ended the session —
 * this only makes it visible at once instead of on the next request (which
 * it would refuse anyway):
 *
 * - `FORCE_LOGOUT` (logged out of all sessions, this session revoked, the
 *   password changed elsewhere, the account deactivated, a timeout): the
 *   access token and the user are cleared, the socket closes (nobody is
 *   signed in any more), and the sign-in page says why. Another tab of this
 *   browser signing out ends this one quietly. However many signals arrive
 *   — the event, then a 401 — it happens once (`SessionExpiry`).
 * - `SYSTEM_LOCKED`: anyone but a Super Administrator is signed out, the
 *   sign-in page naming who locked it (the name comes from the server); a
 *   Super Administrator stays, with a toast, and the bell and the System
 *   Status card refresh. `SYSTEM_UNLOCKED`: the same for unlocking.
 */
@Service()
export class SecurityEvents {
  private readonly auth = inject(AuthService);
  private readonly expiry = inject(SessionExpiry);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly notifications = inject(NotificationsService);
  private readonly changes = inject(SystemLockChanges);

  constructor() {
    const realtime = inject(RealtimeService);
    realtime
      .on<{ reason?: unknown }>(FORCE_LOGOUT)
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this.forceLogout(event?.reason));
    realtime
      .on<unknown>(SYSTEM_LOCKED)
      .pipe(takeUntilDestroyed())
      .subscribe((data) => this.lockChanged(data));
    realtime
      .on<unknown>(SYSTEM_UNLOCKED)
      .pipe(takeUntilDestroyed())
      .subscribe((data) => this.lockChanged(data));
  }

  private forceLogout(reason: unknown): void {
    if (!this.auth.hasSession()) return;
    const notice = forceLogoutNotice(reason);
    if (notice === null) {
      // Signed out in another tab of this browser: no notice, just the sign-in page.
      this.auth.endSession();
      void this.router.navigate(['/login']);
      return;
    }
    this.expiry.end(notice ?? 'session_revoked');
  }

  private lockChanged(data: unknown): void {
    const event = asSystemLockEvent(data);
    const user = this.auth.user();
    if (!event || !user) return;
    const name = this.i18n.pick(event.actor.nameAr, event.actor.nameEn);
    if (event.locked && !isSuperAdministrator(user)) {
      this.expiry.end('system_locked', { actorName: name });
      return;
    }
    const prefix = event.locked ? 'realtime.systemLocked' : 'realtime.systemUnlocked';
    this.toasts.show({ tone: event.locked ? 'warning' : 'info', title: this.i18n.t(`${prefix}.title`), message: this.i18n.t(`${prefix}.body`, { name }) });
    void this.notifications.refresh().catch(() => undefined);
    this.changes.announce(event);
  }
}

/** The payload when it has the expected shape (anything else is ignored). */
function asSystemLockEvent(data: unknown): SystemLockEvent | null {
  const event = data as Partial<SystemLockEvent> | null;
  const valid = typeof event?.locked === 'boolean' && typeof event.actor?.nameEn === 'string' && typeof event.actor.nameAr === 'string';
  return valid ? (event as SystemLockEvent) : null;
}

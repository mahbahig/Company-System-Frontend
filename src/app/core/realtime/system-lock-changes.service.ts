import { Service } from '@angular/core';
import { Subject } from 'rxjs';

/** The API's `SYSTEM_LOCKED` / `SYSTEM_UNLOCKED` payload: the new state, who switched it (names from their account record) and when. */
export interface SystemLockEvent {
  locked: boolean;
  actor: { nameEn: string; nameAr: string };
  occurredAt: string;
}

/**
 * Lock changes the realtime stream told a Super Administrator about (another
 * Super Administrator's switch), for whatever shows the lock — the System
 * Status card refreshes. Only a feed: listening opens no connection.
 */
@Service()
export class SystemLockChanges {
  private readonly changed = new Subject<SystemLockEvent>();
  readonly changes$ = this.changed.asObservable();

  announce(event: SystemLockEvent): void {
    this.changed.next(event);
  }
}

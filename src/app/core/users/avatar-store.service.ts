import { HttpClient } from '@angular/common/http';
import { Service, effect, inject, signal, type Signal, type WritableSignal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

const NONE: Signal<string | null> = signal(null).asReadonly();

/**
 * Employees' profile pictures for this browser session. A picture is not a
 * public URL: it is fetched through the API with the signed-in user's token
 * (`GET /users/:id/avatar`, signed-in employees only) and shown from a local
 * object URL, loaded once per picture version. Everything is dropped when
 * the user signs out.
 */
@Service()
export class AvatarStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly pictures = new Map<string, WritableSignal<string | null>>();

  constructor() {
    effect(() => {
      if (!this.auth.user()) this.clear();
    });
  }

  /**
   * The picture of `userId` as an object URL once loaded — null while loading
   * or when there is none. `version` null means "known to have none" (no
   * request); undefined means "unknown" (asked for, a 404 is remembered).
   */
  url(userId: string, version: string | null | undefined): Signal<string | null> {
    if (version === null || !userId) return NONE;
    const key = `${userId}:${version ?? ''}`;
    const known = this.pictures.get(key);
    if (known) return known;
    const picture = signal<string | null>(null);
    this.pictures.set(key, picture);
    this.http
      .get(`${environment.apiBaseUrl}/users/${encodeURIComponent(userId)}/avatar`, { params: version ? { v: version } : {}, responseType: 'blob' })
      .subscribe({ next: (blob) => picture.set(URL.createObjectURL(blob)), error: () => picture.set(null) });
    return picture;
  }

  /** Forgets one user's pictures (after they changed or removed theirs). */
  forget(userId: string): void {
    for (const [key, picture] of this.pictures) {
      if (!key.startsWith(`${userId}:`)) continue;
      const url = picture();
      if (url) URL.revokeObjectURL(url);
      this.pictures.delete(key);
    }
  }

  private clear(): void {
    for (const picture of this.pictures.values()) {
      const url = picture();
      if (url) URL.revokeObjectURL(url);
    }
    this.pictures.clear();
  }
}

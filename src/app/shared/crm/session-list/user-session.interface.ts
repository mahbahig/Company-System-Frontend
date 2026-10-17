/** One signed-in session, as `GET /auth/sessions` and `GET /users/:id/sessions` return it. */
export interface UserSession {
  id: string;
  /** The session this browser is using (only on one's own list; always first). */
  current: boolean;
  /** Normalised server-side from the sign-in request: `Windows 11`, `macOS`, `iOS`, `Android` …; null when unknown. */
  os: string | null;
  browser: string | null;
  browserVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

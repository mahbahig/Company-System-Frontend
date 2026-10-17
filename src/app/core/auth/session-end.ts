import { HttpContextToken, HttpErrorResponse } from '@angular/common/http';

/**
 * Why the session ended without the user signing out — each has its own
 * notice on the sign-in page (`?reason=`).
 */
export type SessionEndReason = 'session_expired' | 'session_revoked' | 'password_changed_elsewhere' | 'account_inactive';

/**
 * The API's answers that mean "this session is over" — no refresh can bring
 * it back — and how the sign-in page explains each (the API records why it
 * ended a session: `SessionEndReason` in the backend).
 */
const SESSION_OVER: Readonly<Record<string, SessionEndReason>> = {
  'auth.errors.sessionRevoked': 'session_revoked',
  'auth.errors.passwordChangedElsewhere': 'password_changed_elsewhere',
  'auth.errors.accountInactive': 'account_inactive',
  'auth.errors.sessionExpired': 'session_expired',
  'auth.errors.sessionIdle': 'session_expired',
  'auth.errors.tokenBlocked': 'session_expired',
  'auth.errors.userNotFound': 'session_expired',
};

/**
 * The reason when an API error says the current session can no longer be
 * used (a 401 with one of the messages above, or the 403 of a deactivated
 * account); null for anything else — an expired access token (refreshable), a
 * missing permission, a validation error …
 */
export function sessionEndReason(error: unknown): SessionEndReason | null {
  if (!(error instanceof HttpErrorResponse) || (error.status !== 401 && error.status !== 403)) return null;
  const message = (error.error as { message?: unknown } | null)?.message;
  const reason = typeof message === 'string' ? SESSION_OVER[message] : undefined;
  if (!reason) return null;
  // A 403 ends the session only for a deactivated account (other 403s are permissions).
  return error.status === 401 || reason === 'account_inactive' ? reason : null;
}

/**
 * Set on a request whose authentication failure must end the session
 * silently — signing out: the user asked to leave, so no "session expired"
 * notice and no extra navigation.
 */
export const QUIET_SESSION_END = new HttpContextToken<boolean>(() => false);

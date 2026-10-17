import { HttpContextToken, HttpErrorResponse } from '@angular/common/http';

import { errorBodyOf } from '../api/error-body';

/**
 * Why the session ended without the user signing out — each has its own
 * notice on the sign-in page (`?reason=`).
 */
export type SessionEndReason = 'session_expired' | 'session_revoked' | 'password_changed_elsewhere' | 'account_inactive' | 'system_locked';

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
  // A Super Administrator locked the system and signed everyone else out (a 401; sign-in's own refusal is a 403).
  'auth.errors.systemLocked': 'system_locked',
};

/**
 * The reason when an API error says the current session can no longer be
 * used (a 401 with one of the messages above, or the 403 of a deactivated
 * account); null for anything else — an expired access token (refreshable), a
 * missing permission, a validation error …
 */
export function sessionEndReason(error: unknown): SessionEndReason | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const message = errorBodyOf(error)?.message;
  return typeof message === 'string' ? sessionEndReasonFor(message, error.status) : null;
}

/**
 * The same decision for an answer that is not an HTTP response — the
 * realtime socket's refusal (`connect_error`), which carries the API's
 * message and status.
 */
export function sessionEndReasonFor(message: string, status: number | undefined): SessionEndReason | null {
  if (status !== 401 && status !== 403) return null;
  const reason = SESSION_OVER[message];
  if (!reason) return null;
  // A 403 ends the session only for a deactivated account (other 403s are permissions).
  return status === 401 || reason === 'account_inactive' ? reason : null;
}

/**
 * What the server's realtime `FORCE_LOGOUT` reasons mean on the sign-in
 * page; `SIGNED_OUT` (another tab of this browser signed out) needs no
 * notice — null.
 */
const FORCE_LOGOUT: Readonly<Record<string, SessionEndReason | null>> = {
  SIGNED_OUT: null,
  SESSION_REVOKED: 'session_revoked',
  ADMIN_LOGOUT_ALL_SESSIONS: 'session_revoked',
  PASSWORD_CHANGED: 'password_changed_elsewhere',
  ACCOUNT_DEACTIVATED: 'account_inactive',
  SESSION_EXPIRED: 'session_expired',
  SYSTEM_LOCKED: 'system_locked',
};

/** The sign-in notice for a `FORCE_LOGOUT` reason: a reason, null for a quiet sign-out, undefined for a reason this build does not know. */
export function forceLogoutNotice(reason: unknown): SessionEndReason | null | undefined {
  return typeof reason === 'string' && reason in FORCE_LOGOUT ? FORCE_LOGOUT[reason] : undefined;
}

/**
 * Set on a request whose authentication failure must end the session
 * silently — signing out: the user asked to leave, so no "session expired"
 * notice and no extra navigation.
 */
export const QUIET_SESSION_END = new HttpContextToken<boolean>(() => false);

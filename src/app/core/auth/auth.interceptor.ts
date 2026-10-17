import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { I18nService } from '../i18n/i18n.service';
import { AuthService } from './auth.service';
import { QUIET_SESSION_END, sessionEndReason, type SessionEndReason } from './session-end';
import { SessionExpiry } from './session-expiry.service';
import { TokenStore } from './token-store.service';

/** Endpoints that must never trigger a refresh-and-retry loop (their own 401s are answers, not expiry). */
const NO_REFRESH = ['auth/login', 'auth/refresh', 'auth/mfa/verify'];

/**
 * Adds the bearer token and the UI language to API requests, and reacts when
 * the API says the session is not valid any more — centrally, for every request:
 *
 * - an expired access token (401): refresh it ONCE through
 *   `AuthService.refreshAccessToken` (the HttpOnly cookie; concurrent
 *   failures share one refresh) and replay the request — the user stays
 *   signed in; the refresh call itself is never retried (no loop);
 * - the refresh fails, or the API says the session is over (revoked, the
 *   password changed elsewhere, the account deactivated, expired): the local
 *   session is ended and the sign-in page says why (`SessionExpiry`, once);
 * - anything else (a missing permission, a validation error …) passes through.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.apiBaseUrl)) return next(request);

  const tokens = inject(TokenStore);
  const auth = inject(AuthService);
  const i18n = inject(I18nService);
  const expiry = inject(SessionExpiry);

  const withHeaders = (req: HttpRequest<unknown>, token: string | null) =>
    req.clone({
      setHeaders: { 'Accept-Language': i18n.locale(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  /** Signing out ends the session without a notice; every other request says why. */
  const endSession = (reason: SessionEndReason) => (request.context.get(QUIET_SESSION_END) ? auth.endSession() : expiry.end(reason));

  return next(withHeaders(request, tokens.accessToken())).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || NO_REFRESH.some((path) => request.url.endsWith(path))) return throwError(() => error);
      const over = sessionEndReason(error);
      if (over) {
        endSession(over);
        return throwError(() => error);
      }
      if (error.status !== 401) return throwError(() => error);

      return auth.refreshAccessToken().pipe(
        switchMap((token) => {
          if (token) return next(withHeaders(request, token));
          endSession(auth.refusalReason() ?? 'session_expired');
          return throwError(() => error);
        }),
      );
    }),
  );
};

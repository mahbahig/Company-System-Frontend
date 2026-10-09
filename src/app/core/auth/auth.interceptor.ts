import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { I18nService } from '../i18n/i18n.service';
import { AuthService } from './auth.service';
import { TokenStore } from './token-store.service';

/** Endpoints that must never trigger a refresh-and-retry loop. */
const NO_REFRESH = ['auth/login', 'auth/refresh'];

/**
 * Adds the bearer token and the UI language to API requests. On a 401 it
 * refreshes the access token ONCE and replays the request; if the refresh
 * fails the session is over and the user is sent to the login page.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.apiBaseUrl)) return next(request);

  const tokens = inject(TokenStore);
  const auth = inject(AuthService);
  const i18n = inject(I18nService);
  const router = inject(Router);

  const withHeaders = (req: HttpRequest<unknown>, token: string | null) =>
    req.clone({
      setHeaders: { 'Accept-Language': i18n.locale(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });

  return next(withHeaders(request, tokens.accessToken())).pipe(
    catchError((error: unknown) => {
      const canRefresh =
        error instanceof HttpErrorResponse && error.status === 401 && !NO_REFRESH.some((path) => request.url.endsWith(path));
      if (!canRefresh) return throwError(() => error);

      return auth.refreshAccessToken().pipe(
        switchMap((token) => {
          if (token) return next(withHeaders(request, token));
          const returnTo = router.url;
          void router.navigate(['/', i18n.locale(), 'login'], { queryParams: { reason: 'signin_required', returnTo } });
          return throwError(() => error);
        }),
      );
    }),
  );
};

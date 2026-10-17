import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { errorBodyOf } from '../api/error-body';
import { MAINTENANCE_MESSAGES, MaintenanceService } from './maintenance.service';

/**
 * When the API answers any request with its maintenance message (503
 * `errors.maintenance`, or `auth.errors.maintenance` at sign-in), the whole
 * application shows the maintenance screen — centrally, for every request.
 * The error still reaches the caller; nothing else changes (the session is kept).
 */
export const maintenanceInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.apiBaseUrl)) return next(request);
  const maintenance = inject(MaintenanceService);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 503 && MAINTENANCE_MESSAGES.has(String(errorBodyOf(error)?.message ?? ''))) maintenance.enter();
      return throwError(() => error);
    }),
  );
};

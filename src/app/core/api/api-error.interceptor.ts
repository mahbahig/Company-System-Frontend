import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import type { ApiErrorBody } from './api-error-body.interface';
import { ApiError } from './api-error';

/** Normalises every HTTP failure into an `ApiError` carrying the backend's i18n key. */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const body = typeof error.error === 'object' ? (error.error as Partial<ApiErrorBody> | null) : null;
        return throwError(() => new ApiError(error.status, body));
      }
      return throwError(() => error);
    }),
  );

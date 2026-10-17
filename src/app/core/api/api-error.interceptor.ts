import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { ApiError } from './api-error';
import { errorBodyOf } from './error-body';

/** Normalises every HTTP failure into an `ApiError` carrying the backend's i18n key. */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        return throwError(() => new ApiError(error.status, errorBodyOf(error)));
      }
      return throwError(() => error);
    }),
  );

import type { HttpErrorResponse } from '@angular/common/http';

import type { ApiErrorBody } from './api-error-body.interface';

/**
 * An error response's body as the API sent it. A request that asked for text
 * (the realtime stream) gets the JSON error envelope as a string — parsed
 * here, so every interceptor reads its answer (session over, maintenance …)
 * like any other request's.
 */
export function errorBodyOf(error: HttpErrorResponse): Partial<ApiErrorBody> | null {
  const body: unknown = error.error;
  if (typeof body === 'string') {
    if (!body.trimStart().startsWith('{')) return null;
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? (parsed as Partial<ApiErrorBody>) : null;
    } catch {
      return null;
    }
  }
  return body && typeof body === 'object' ? (body as Partial<ApiErrorBody>) : null;
}

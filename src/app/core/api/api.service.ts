import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { QueryParams } from './query-params.type';

/**
 * Thin typed wrapper over HttpClient for the NestJS API.
 *
 * Responses arrive as `{ success: true, ...body }` (arrays and primitives
 * under `data`); this unwraps them so callers get the plain payload.
 * Errors are converted to `ApiError` by `apiErrorInterceptor`.
 */
@Service()
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, query?: QueryParams): Observable<T> {
    return this.http.get<unknown>(this.url(path), { params: this.params(query) }).pipe(map((body) => this.unwrap<T>(body)));
  }

  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.post<unknown>(this.url(path), body).pipe(map((response) => this.unwrap<T>(response)));
  }

  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.patch<unknown>(this.url(path), body).pipe(map((response) => this.unwrap<T>(response)));
  }

  put<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.put<unknown>(this.url(path), body).pipe(map((response) => this.unwrap<T>(response)));
  }

  delete<T = void>(path: string, body?: unknown): Observable<T> {
    return this.http.delete<unknown>(this.url(path), body === undefined ? {} : { body }).pipe(map((response) => this.unwrap<T>(response)));
  }

  /** Multipart upload (`FormData`), e.g. documents and import files. */
  upload<T>(path: string, body: FormData): Observable<T> {
    return this.http.post<unknown>(this.url(path), body).pipe(map((response) => this.unwrap<T>(response)));
  }

  /**
   * Downloads a file through the authenticated client (exports, error
   * reports) and hands it to the browser; the file name comes from the
   * server's Content-Disposition header.
   */
  download(path: string, query?: QueryParams, fallbackName = 'download'): Observable<void> {
    return this.http.get(this.url(path), { params: this.params(query), observe: 'response', responseType: 'blob' }).pipe(
      map((response) => {
        const disposition = response.headers.get('Content-Disposition') ?? '';
        const match = /filename="?([^";]+)"?/i.exec(disposition);
        const name = match ? decodeURIComponent(match[1]) : fallbackName;
        const href = URL.createObjectURL(response.body as Blob);
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.download = name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
      }),
    );
  }

  url(path: string): string {
    return `${environment.apiBaseUrl}/${path.replace(/^\//, '')}`;
  }

  private unwrap<T>(body: unknown): T {
    if (body === null || typeof body !== 'object' || !('success' in body)) return body as T;
    const { success: _success, ...rest } = body as Record<string, unknown>;
    const keys = Object.keys(rest);
    return (keys.length === 1 && keys[0] === 'data' ? rest['data'] : rest) as T;
  }

  private params(query?: QueryParams): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === null || value === undefined || value === '') continue;
      if (Array.isArray(value)) {
        if (value.length) params = params.set(key, value.join(','));
      } else {
        params = params.set(key, String(value));
      }
    }
    return params;
  }
}

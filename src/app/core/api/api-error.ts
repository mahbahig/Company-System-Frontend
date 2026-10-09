import type { ApiErrorBody } from './api-error-body.interface';

/**
 * Every failed API call surfaces as an ApiError: components show
 * `messageKey` through the translate pipe and bind `fieldErrors` to inputs.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly messageKey: string;
  readonly fieldErrors: Record<string, string>;
  readonly details: unknown;

  constructor(status: number, body: Partial<ApiErrorBody> | null) {
    const key = body?.message ?? (status === 0 ? 'errors.network' : 'errors.unexpected');
    super(key);
    this.name = 'ApiError';
    this.status = status;
    this.messageKey = key;
    this.fieldErrors = body?.fieldErrors ?? {};
    this.details = body?.details;
  }

  static is(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}

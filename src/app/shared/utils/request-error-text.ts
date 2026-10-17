import { ApiError } from '../../core/api/api-error';
import type { I18nService } from '../../core/i18n/i18n.service';

/**
 * The message for a failed request of a one-field form (a code, a password, a
 * picture): the API's error for that field when it named one, otherwise the
 * request's own message — without the generic field list `errorText` appends.
 */
export function requestErrorText(i18n: I18nService, error: unknown, field: string): string {
  if (ApiError.is(error)) {
    const fieldKey = error.fieldErrors[field];
    if (fieldKey && i18n.has(fieldKey)) return i18n.t(fieldKey);
    if (i18n.has(error.messageKey)) return i18n.t(error.messageKey);
  }
  return i18n.errorText(error);
}

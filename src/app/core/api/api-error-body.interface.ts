/** Error envelope produced by the backend's HttpExceptionFilter. */
export interface ApiErrorBody {
  success: false;
  statusCode: number;
  /** i18n key, e.g. `errors.validation`, `auth.errors.invalidCredentials`. */
  message: string;
  /** Field → i18n key (Zod validation). */
  fieldErrors?: Record<string, string>;
  /** Structured context, e.g. duplicate matches or missing gate items. */
  details?: unknown;
}

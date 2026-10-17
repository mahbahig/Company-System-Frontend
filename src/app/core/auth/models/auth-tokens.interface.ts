/**
 * A started (or refreshed) session as the API answers it: the short-lived
 * access token only. The refresh token travels in an HttpOnly cookie and is
 * never part of a response body.
 */
export interface AuthTokens {
  accessToken: string;
}

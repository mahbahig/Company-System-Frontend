/** `POST /auth/login` response: a short-lived JWT plus an opaque refresh token. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** A one-time code was e-mailed to the account's own address (never the code itself). */
export interface MfaCodeSent {
  /** The address, masked (`r•••@ecotech.com`). */
  destination: string;
  expiresAt: string;
  /** When another code may be asked for. */
  resendAvailableAt: string;
}

/** The second sign-in step: answer with the e-mailed code at `auth/mfa/verify`. */
export interface MfaChallenge extends MfaCodeSent {
  mfaToken: string;
}

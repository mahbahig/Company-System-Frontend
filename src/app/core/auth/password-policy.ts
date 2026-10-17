/**
 * The API's password policy (`passwordPolicyError` — the authority): at least
 * 6 characters with at least one letter (A-Z or a-z). Digits and symbols are
 * allowed, never required. The forms use this only to guide the user as they type.
 */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_LETTER = /[A-Za-z]/;

/** The API's message key for a password that breaks the policy, or null when it meets it. */
export function passwordPolicyProblem(value: string): 'validation.passwordTooShort' | 'validation.passwordLetterRequired' | null {
  if (value.length < PASSWORD_MIN_LENGTH) return 'validation.passwordTooShort';
  if (!PASSWORD_LETTER.test(value)) return 'validation.passwordLetterRequired';
  return null;
}

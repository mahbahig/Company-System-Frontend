/**
 * A real e-mail address: something@domain.tld with no spaces. The forms
 * (sign-in, New Employee) use it to guide the user before anything is sent;
 * the API checks every address again and is the authority (`zEmail`).
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Why a typed address cannot be sent: empty, or not an address. Surrounding spaces are ignored (the API trims them too). */
export function emailFormatProblem(value: string): 'required' | 'invalid' | null {
  const email = value.trim();
  if (!email) return 'required';
  return EMAIL_PATTERN.test(email) ? null : 'invalid';
}

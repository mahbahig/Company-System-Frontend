/**
 * Client-side copies of the API's phone / e-mail rules
 * (Backend `common/utils/phone.ts`, `zMobile`, `zPhone`, `zEmail`) so a form
 * can say what is wrong — and how to fix it — before submitting. They accept
 * at least everything the API accepts; the API stays the authority.
 */
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

function asciiDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const a = ARABIC_INDIC.indexOf(ch);
    const b = EXTENDED_ARABIC_INDIC.indexOf(ch);
    out += a >= 0 ? String(a) : b >= 0 ? String(b) : ch;
  }
  return out;
}

/** `01012345678` / `+20 100 123 4567` / `0020…` → `201012345678` (same as the API). */
export function normalizePhone(input: string | null | undefined): string | null {
  if (input == null) return null;
  let digits = asciiDigits(String(input)).replace(/[^0-9]/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `20${digits.slice(1)}`;
  else if (digits.startsWith('1') && digits.length === 10) digits = `20${digits}`;
  return digits;
}

/** Egyptian mobile (010 / 011 / 012 / 015 + 8 digits) or a plausible international number. Empty is valid (use `required`). */
export function isValidMobile(input: string | null | undefined): boolean {
  if (input == null || input.trim() === '') return true;
  const normalized = normalizePhone(input);
  if (!normalized) return false;
  if (/^20(10|11|12|15)[0-9]{8}$/.test(normalized)) return true;
  if (normalized.startsWith('20')) return false;
  return /^[1-9][0-9]{7,14}$/.test(normalized);
}

/** Any Egyptian number (mobile or landline) or plausible E.164. Empty is valid. */
export function isValidPhone(input: string | null | undefined): boolean {
  if (input == null || input.trim() === '') return true;
  const normalized = normalizePhone(input);
  return !!normalized && /^[1-9][0-9]{7,14}$/.test(normalized);
}

/** A pragmatic shape check (`name@domain.tld`); empty is valid. */
export function isValidEmail(input: string | null | undefined): boolean {
  if (input == null || input.trim() === '') return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

/** Signal-forms validators: `validate(path.phone, mobileValidator)`. Messages say how to fix the value. */
export const mobileValidator = ({ value }: { value: () => string }) =>
  isValidMobile(value()) ? null : { kind: 'mobile', message: 'ux.validation.mobile' };

export const phoneValidator = ({ value }: { value: () => string }) =>
  isValidPhone(value()) ? null : { kind: 'phone', message: 'ux.validation.phone' };

export const emailValidator = ({ value }: { value: () => string }) =>
  isValidEmail(value()) ? null : { kind: 'email', message: 'ux.validation.email' };

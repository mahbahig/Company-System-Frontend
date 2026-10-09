/** UI languages. Arabic is the default and renders right-to-left. */
export const LOCALES = ['ar', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ar';

/** Business time zone: every date is shown in Cairo time (Gregorian). */
export const TIME_ZONE = 'Africa/Cairo';

/** Each language's name in its own script, as the switcher shows it. */
export const LOCALE_NAMES: Record<Locale, string> = {
  ar: 'العربية',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function directionFor(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

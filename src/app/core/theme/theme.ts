/** Theme preference; `system` follows the OS setting live. */
export const THEMES = ['light', 'dark', 'system'] as const;

export type Theme = (typeof THEMES)[number];

/** Browser-chrome colour per resolved theme (matches --background). */
export const THEME_COLORS = {
  light: '#ffffff',
  dark: '#11171d',
} as const;

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

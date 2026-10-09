/** Joins class names, skipping falsy values (the Next app's `cn`, minus tailwind-merge). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

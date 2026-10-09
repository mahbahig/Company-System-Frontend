import type { UserRef } from '../../core/auth/models/user-ref.interface';

/** Narrows a populated user reference (vs a bare id string). */
export function asUserRef(value: UserRef | string | null | undefined): UserRef | null {
  return value && typeof value === 'object' ? value : null;
}

/** Bilingual name of a populated user reference, or a dash when not populated / empty. */
export function userName(pick: (ar: string | null | undefined, en: string | null | undefined) => string, value: UserRef | string | null | undefined): string {
  const ref = asUserRef(value);
  return ref ? pick(ref.fullNameAr, ref.fullNameEn) : '—';
}

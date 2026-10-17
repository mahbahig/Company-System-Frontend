import { numberAttribute } from '@angular/core';

/** The page sizes every table offers ("Items per page"). */
export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

/** The project-wide default page size — the API's default too (`ListQuerySchema`). */
export const DEFAULT_PAGE_SIZE = 20;

/** `?pageSize=` from the address: one of the offered sizes, anything else falls back to the default. */
export function pageSizeAttribute(value: unknown): number {
  const size = numberAttribute(value, DEFAULT_PAGE_SIZE);
  return PAGE_SIZE_OPTIONS.includes(size) ? size : DEFAULT_PAGE_SIZE;
}

import type { FilterOption } from './filter-option.interface';

/** A select filter in the list toolbar; `name` is the query-string key. */
export interface FilterDefinition {
  name: string;
  label: string;
  options: FilterOption[];
  /** Current value from the URL ('' = any). */
  value: string;
}

/** Query-string values accepted by ApiService; null / undefined / '' are dropped. */
export type QueryParams = Record<string, string | number | boolean | readonly (string | number)[] | null | undefined>;

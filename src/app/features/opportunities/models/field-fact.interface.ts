/** A fact with its explicit state: unknown is never complete. */
export interface FieldFact {
  state: 'known' | 'unknown' | 'not_applicable' | 'awaiting_customer';
  value?: unknown;
  note?: string;
}

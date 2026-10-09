/** One completeness rule outcome (backend CPL engine). */
export interface CompletenessItem {
  id: string;
  section: string;
  level: 'save' | 'gate' | 'recommended';
  /** Stage/gate the item is required for, e.g. `active`, `qualified`. */
  gate?: string;
  responsibleRole?: string;
  field?: string;
  satisfied: boolean;
}

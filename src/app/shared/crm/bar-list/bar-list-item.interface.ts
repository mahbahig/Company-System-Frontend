/** One row of `<app-bar-list>`. */
export interface BarListItem {
  label: string;
  value: number;
  /** Pre-formatted value text (money, percent …); defaults to the number. */
  display?: string;
  /** Optional secondary text after the label. */
  note?: string;
}

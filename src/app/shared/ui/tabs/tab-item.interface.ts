/** One tab of `<app-tabs>`. */
export interface TabItem {
  id: string;
  label: string;
  /** Optional counter shown next to the label. */
  count?: number | null;
}

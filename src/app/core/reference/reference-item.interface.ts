/** One master-data value (backend `reference_items`). */
export interface ReferenceItem {
  id: string;
  type: string;
  code: string;
  nameAr: string;
  nameEn: string;
  order: number;
  isActive: boolean;
  isSystem?: boolean;
  /** Parent code (city → governorate). */
  parentCode?: string;
  /** Type-specific extras, e.g. `tone` for statuses, `probability` for stages. */
  meta?: Record<string, unknown>;
}

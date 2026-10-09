/** Customer as embedded (populated) in an opportunity. */
export interface CustomerRef {
  id: string;
  customerNo: string;
  nameAr?: string;
  nameEn?: string;
  primaryContactName?: string;
}

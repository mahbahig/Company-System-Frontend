/** Primary contact as embedded (populated) in an opportunity detail. */
export interface ContactRef {
  id: string;
  fullName: string;
  fullNameEn?: string;
  mobile?: string;
  email?: string;
  roleCode?: string;
}

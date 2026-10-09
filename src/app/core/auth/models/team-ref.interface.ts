/** A team the current user belongs to or manages. */
export interface TeamRef {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  managerId?: string | null;
}

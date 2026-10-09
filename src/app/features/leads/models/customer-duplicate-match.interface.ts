/** DUP-01/LEAD-07: a possible duplicate customer returned by the 409 `errors.possibleDuplicates` response. */
export interface CustomerDuplicateMatch {
  customerId: string;
  customerNo?: string;
  score: number;
  nameAr?: string;
  nameEn?: string;
  primaryContactName?: string;
  ownerNameAr?: string;
  ownerNameEn?: string;
  /** The current user may open (and so link to) this customer. */
  canAccess?: boolean;
}

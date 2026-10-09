/** Result of a successful lead conversion. */
export interface ConversionResult {
  customerId: string;
  contactId?: string | null;
  siteId?: string | null;
  opportunityId?: string | null;
  linkedExistingCustomer: boolean;
}

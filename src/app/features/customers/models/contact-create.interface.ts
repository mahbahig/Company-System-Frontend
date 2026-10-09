/** `POST /customers/:customerId/contacts` body (`CreateContactDto`). */
export interface ContactCreate {
  fullName: string;
  fullNameEn?: string;
  roleCode: string;
  jobTitle?: string;
  department?: string;
  mobile: string;
  otherPhones?: string[];
  email?: string;
  preferredChannel?: string;
  hasWhatsapp?: boolean;
  isPrimary?: boolean;
  decisionAuthority?: string;
  influenceLevel?: number;
  notes?: string;
}

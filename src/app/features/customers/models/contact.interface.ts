/** A customer contact (backend `contacts`). */
export interface Contact {
  id: string;
  customerId: string;
  fullName: string;
  jobTitle?: string;
  department?: string;
  roleCode?: string;
  mobile?: string;
  email?: string;
  preferredChannel?: string;
  hasWhatsapp?: boolean;
  isPrimary: boolean;
  influenceLevel?: number;
  isActive: boolean;
}

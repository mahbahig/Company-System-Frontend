/**
 * `POST /leads/:id/convert` payload, mirrors `ConvertLeadSchema` (CONV-01..03).
 * Anything the lead already holds is taken from the lead by the server, so
 * these only carry what a lead does not have.
 */
export interface ConvertLeadPayload {
  existingCustomerId?: string;
  customer?: {
    kind: 'individual' | 'company' | 'government' | 'ngo';
    nameAr?: string;
    nameEn?: string;
    sectorCode?: string;
    categoryCode?: string;
    governorateCode?: string;
    addressLine?: string;
    email?: string;
  };
  contact?: {
    fullName?: string;
    roleCode?: string;
    mobile?: string;
    email?: string;
    jobTitle?: string;
  };
  site?: Record<string, unknown>;
  opportunity?: {
    name?: string;
    solutionTypeCode?: string;
    estimatedValue?: number;
    estimatedKwp?: number;
    expectedCloseDate?: string;
    nextAction?: string;
    nextActionAt?: string;
  };
  confirmDuplicate?: boolean;
}

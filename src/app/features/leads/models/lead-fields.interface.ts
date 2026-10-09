import type { Qualification } from './qualification.interface';

/** Shared fields of the full lead form (create + update), mirrors `LeadFieldsSchema`. */
export interface LeadFields {
  name: string;
  companyName?: string;
  contactPerson?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  governorateCode?: string;
  cityCode?: string;
  addressLine?: string;
  categoryCode?: string;
  sectorCode?: string;
  requestedServiceCode?: string;
  solutionTypeCode?: string;
  sourceCode: string;
  campaignCode?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  qualification?: Qualification;
  estimatedValue?: number;
  qualityCode?: string;
  nextFollowUpAt?: string;
  nextAction?: string;
  notes?: string;
}

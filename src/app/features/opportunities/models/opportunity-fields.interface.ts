/** OPP-01 fields shared by create and update (`POST/PATCH /opportunities`). */
export interface OpportunityFields {
  name: string;
  customerId: string;
  primaryContactId?: string;
  siteId?: string;
  solutionTypeCode: string;
  serviceTypeCode?: string;
  estimatedValue?: number;
  estimatedKwp?: number;
  storageKwh?: number;
  expectedCloseDate?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  competitorCodes?: string[];
  competitorNotes?: string;
  nextAction?: string;
  nextActionAt?: string;
  leadSourceCode?: string;
  campaignCode?: string;
  notes?: string;
  ownerId?: string;
}

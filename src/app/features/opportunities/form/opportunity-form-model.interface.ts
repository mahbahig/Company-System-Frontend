/** Local editable model for the opportunity create/edit Signal Form. */
export interface OpportunityFormModel {
  name: string;
  customerId: string;
  primaryContactId: string;
  siteId: string;
  solutionTypeCode: string;
  serviceTypeCode: string;
  estimatedValue: number | null;
  estimatedKwp: number | null;
  storageKwh: number | null;
  expectedCloseDate: string;
  priority: 'low' | 'normal' | 'high' | 'urgent' | '';
  leadSourceCode: string;
  campaignCode: string;
  nextAction: string;
  nextActionAt: string;
  notes: string;
  ownerId: string;
}

export const EMPTY_OPPORTUNITY_FORM: OpportunityFormModel = {
  name: '',
  customerId: '',
  primaryContactId: '',
  siteId: '',
  solutionTypeCode: '',
  serviceTypeCode: '',
  estimatedValue: null,
  estimatedKwp: null,
  storageKwh: null,
  expectedCloseDate: '',
  priority: '',
  leadSourceCode: '',
  campaignCode: '',
  nextAction: '',
  nextActionAt: '',
  notes: '',
  ownerId: '',
};

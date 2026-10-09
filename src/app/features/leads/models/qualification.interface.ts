/** LEAD-18 qualification block, shared by the lead detail and full form. */
export interface Qualification {
  avgMonthlyConsumptionKwh?: number;
  avgMonthlyBill?: number;
  estimatedSizeKwp?: number;
  budget?: number;
  financingInterest?: boolean;
  timeline?: 'immediate' | '1_3_months' | '3_6_months' | '6_12_months' | 'over_12_months';
  siteAvailability?: string;
  interestLevel?: number;
  decisionMakerName?: string;
  decisionMakerRole?: string;
  requirements?: string;
}

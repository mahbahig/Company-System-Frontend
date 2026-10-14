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
  /** L3 facts recorded on the lead. */
  useCase?: string;
  contactRole?: string;
  verificationState?: 'unverified' | 'pending' | 'verified';
  decisionMakerStatus?: 'decision_maker' | 'influencer' | 'unknown';
  constraints?: string;
  /** The recorded L3 outcome and conversation summary. */
  outcome?: 'qualified' | 'nurture' | 'disqualified' | 'escalated';
  conversationSummary?: string;
}

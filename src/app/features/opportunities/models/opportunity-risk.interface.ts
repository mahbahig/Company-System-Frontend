/** A risk on the opportunity (or project) register. */
export interface OpportunityRisk {
  id?: string;
  _id?: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ownerId?: string | null;
  mitigation?: string;
  status: 'open' | 'mitigated' | 'accepted' | 'closed';
}

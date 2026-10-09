/** Deal health (HEALTH-01..06) — a status is always accompanied by its reasons. */
export interface OpportunityHealth {
  status: 'healthy' | 'watch' | 'at_risk' | 'critical';
  reasons: Array<{ code: string; value?: number }>;
  computedAt?: string;
}

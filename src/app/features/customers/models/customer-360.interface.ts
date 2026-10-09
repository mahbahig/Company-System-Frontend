/** `GET customers/:id/360` (CUST-03). Money fields are absent without `financials.view`. */
export interface Customer360 {
  summary: {
    openOpportunities: number;
    wonOpportunities: number;
    lostOpportunities: number;
    activeProjects: number;
    openTasks: number;
    documents: number;
    lifetimeValue?: number;
  };
  leads: Array<{ id: string; leadNo: string; name: string; status: string; sourceCode?: string; createdAt: string }>;
  opportunities: Array<{ id: string; opportunityNo: string; name?: string; stage?: string; outcome?: string; restricted?: boolean }>;
  proposals: Array<{ id: string; proposalNo: string; versionNo: number; status: string; opportunityId: string; price?: number; priceWithVat?: number; kwp?: number; validUntil?: string; isFinal?: boolean }>;
  contracts: Array<{ id: string; contractNo: string; versionNo: number; status: string; opportunityId: string; value?: number; contractDate?: string; projectId?: string }>;
  projects: Array<{ id: string; projectNo: string; name: string; status: string; installationProgressPct?: number; isDelayed?: boolean; contractValue?: number; kwp?: number; targetEndDate?: string }>;
  activities: {
    activities: Array<{ id: string; channel: string; direction: string; occurredAt: string; subject?: string; body?: string }>;
    calls: Array<{ id: string; direction: string; occurredAt: string; outcomeCode: string; summary?: string }>;
    meetings: Array<{ id: string; subject: string; scheduledAt: string; status: string; mode: string }>;
    visits: Array<{ id: string; visitNo: string; scheduledAt: string; status: string; purpose: string }>;
  };
  tasks: Array<{ id: string; title: string; dueAt?: string; status: string; priority?: string }>;
}

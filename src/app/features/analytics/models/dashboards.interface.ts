import type { KpiMap, KpiValue } from './kpi-value.interface';

export type DashboardCode = 'personal' | 'executive' | 'sales' | 'marketing' | 'operational' | 'finance' | 'platform';

export interface FunnelRow {
  stage: string;
  count: number;
  value: number;
  weighted: number;
}

export interface ProjectSummary {
  byStatus: Array<{ status: string; count: number; value: number }>;
  active: number;
  delayed: number;
  averageProgress: number | null;
}

export interface ExecutiveDashboard {
  scope: string;
  kpis: KpiMap;
  counts: Record<string, number>;
  funnel: FunnelRow[];
  projects: ProjectSummary;
  trend: Array<{ month: string; leads: number; won: number; wonValue: number }>;
}

export interface SalesRepRow {
  userId: string;
  fullNameAr?: string;
  fullNameEn?: string;
  leads: number;
  selfSourced: number;
  assigned: number;
  contactRate: number | null;
  qualificationRate: number | null;
  converted: number;
  opportunitiesCreated: number;
  openOpportunities: number;
  pipelineValue: number;
  proposalConversion: number | null;
  won: number;
  lost: number;
  wonValue: number;
  winRate: number | null;
  salesCycleDays: number | null;
  followUpPerformance: number | null;
  overdueActivities: number;
  enrichmentCompletion: number | null;
}

export interface SalesDashboard {
  scope: string;
  kpis: KpiMap;
  reps: SalesRepRow[];
  funnel: FunnelRow[];
}

export interface CampaignRow {
  code: string;
  nameAr: string;
  nameEn: string;
  channelCode?: string;
  spend: number;
  budget: number;
  leads: number;
  qualified: number;
  opportunities: number;
  proposals: number;
  contracts: number;
  won: number;
  lost: number;
  revenue: number;
  costPerLead: number | null;
  costPerWon: number | null;
  lossReasons: Record<string, number>;
  quality: Record<string, number>;
}

export interface MarketingDashboard {
  scope: string;
  attribution: string;
  kpis: KpiMap;
  campaigns: CampaignRow[];
  sources: Array<{ code: string; leads: number; qualified: number; converted: number; opportunities: number; won: number; revenue: number; qualifiedRate: number | null }>;
  leadQuality: Array<{ code: string; count: number }>;
}

export interface WorkloadRow {
  userId: string;
  fullNameAr?: string;
  fullNameEn?: string;
  tasks: number;
  assessments: number;
  technicalProposals: number;
  financialProposals: number;
  projects: number;
  total: number;
}

export interface OperationalDashboard {
  scope: string;
  counts: Record<string, number>;
  projects: ProjectSummary;
  workload: WorkloadRow[];
}

export interface FinanceDashboard {
  scope: string;
  approvals: Array<{ type: string; pending: number; overdue: number }>;
  discountDistribution: Array<{ bucket: number | string; count: number; value: number }>;
  margins: Array<{ id?: string; number: string; versionNo: number; status: string; opportunityId: string; opportunityNo?: string; opportunityName?: string; listPrice: number; finalPrice: number; totalCost: number; discountPct: number; marginPct: number; marginAmount: number }>;
  contractValues: Array<{ status: string; count: number; value: number }>;
  paymentSchedule: Array<{ month: string; due: number; paid: number; milestones: number }>;
  /** Totals over all project payment milestones in scope. */
  payments?: { total: number; collected: number; outstanding: number };
  kpis: KpiValue[];
}

/** The personal workspace; a section is `null` when the user's role does not work with that area. */
export interface PersonalDashboard {
  scope: string;
  leads: Record<string, number> | null;
  followUpsDue: number | null;
  tasks: { open: number; overdue: number; today: number } | null;
  opportunities: { open: number; pipelineValue: number; withoutNextAction: number } | null;
  approvalsPending: number | null;
  upcomingVisits: number | null;
  projects: { active: number; delayed: number; milestonesDueThisWeek: number } | null;
  kpis: KpiMap;
}

/** The System Administrator's platform dashboard — counts only, no business data. */
export interface PlatformDashboard {
  users: { active: number; inactive: number; locked: number; pendingPasswordChange: number };
  activeSessions: number;
  automation: { failed: number; succeededLast24h: number };
  security: { failedLoginsLast24h: number; eventsLast24h: number };
  integrations: { activeKeys: number };
}

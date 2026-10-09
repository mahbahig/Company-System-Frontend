import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { CompletenessResult } from '../../shared/crm/completeness-panel/completeness-result.interface';
import type { Person, ProposalTeam } from '../proposals/proposals.models';

type SubId = { id?: string; _id?: string };

export interface Project {
  id: string;
  projectNo: string;
  name: string;
  opportunityId: { id: string; opportunityNo: string; name: string } | string;
  contractId: { id: string; contractNo: string } | string;
  customerId: { id: string; customerNo: string; nameAr?: string; nameEn?: string } | string;
  siteId?: { id: string; name?: string; addressLine?: string } | string | null;
  pmId?: Person;
  salesRepId?: Person;
  engineerId?: Person;
  techLeadId?: Person;
  opsIds: Person[];
  status: string;
  phases: Array<SubId & { code: string; status: string; plannedStart?: string | null; plannedEnd?: string | null; actualStart?: string | null; actualEnd?: string | null }>;
  milestones: Array<SubId & { title: string; phaseCode?: string; dueAt?: string | null; status: string; ownerId?: Person; completedAt?: string | null; notes?: string }>;
  procurement: Array<SubId & { description: string; category?: string; model?: string; quantity: number; supplier?: string; poNumber?: string; status: string; orderedAt?: string | null; expectedAt?: string | null; receivedAt?: string | null; notes?: string }>;
  payments: Array<SubId & { name: string; pct: number; amount: number; trigger?: string; dueAt?: string | null; status: string; invoicedAt?: string | null; paidAt?: string | null }>;
  installationProgressPct: number;
  startDate?: string | null;
  targetEndDate?: string | null;
  closedAt?: string | null;
  contractValue?: number;
  kwp: number;
  storageKwh?: number;
  scope?: string;
  notes?: string;
  commissioning?: { testResults: Array<{ test: string; result: string; passed: boolean; notes?: string }>; commissionedAt?: string | null; utilityConnectionStatus?: string; netMeteringStatus?: string; notes?: string } | null;
  handover?: { documentIds: string[]; warranties: Array<{ item: string; provider?: string; years: number; startDate?: string | null }>; customerAcceptedAt?: string | null; acceptedByName?: string; notes?: string } | null;
  delays: Array<{ reason: string; days: number; phaseCode?: string; at: string; by: Person }>;
  isDelayed: boolean;
  customerUpdates: Array<{ at: string; channel: string; message: string; by: Person }>;
  proposalTeam: ProposalTeam;
  inherited: Record<string, unknown>;
}

export interface ProjectDetail {
  project: Project;
  completeness: CompletenessResult;
  permissions: { canManage: boolean; canExecute: boolean; canUpdatePayments: boolean };
  nextStatuses: string[];
}

/** Typed client for projects (PROJ-01..10). */
@Service()
export class ProjectsApi {
  private readonly api = inject(ApiService);

  list(query: { status?: string; delayed?: boolean; mine?: boolean; q?: string; page?: number; customerId?: string; opportunityId?: string }): Observable<Page<Project>> {
    return this.api.get('projects', query);
  }
  get(id: string): Observable<ProjectDetail> {
    return this.api.get(`projects/${id}`);
  }
  update(id: string, body: Record<string, unknown>): Observable<Project> {
    return this.api.patch(`projects/${id}`, body);
  }
  status(id: string, body: { status: string; reason?: string }): Observable<Project> {
    return this.api.post(`projects/${id}/status`, body);
  }
  addMilestone(id: string, body: Record<string, unknown>): Observable<Project> {
    return this.api.post(`projects/${id}/milestones`, body);
  }
  updateMilestone(id: string, milestoneId: string, body: Record<string, unknown>): Observable<Project> {
    return this.api.patch(`projects/${id}/milestones/${milestoneId}`, body);
  }
  addProcurement(id: string, body: Record<string, unknown>): Observable<Project> {
    return this.api.post(`projects/${id}/procurement`, body);
  }
  updateProcurement(id: string, itemId: string, body: Record<string, unknown>): Observable<Project> {
    return this.api.patch(`projects/${id}/procurement/${itemId}`, body);
  }
  updatePayment(id: string, paymentId: string, body: Record<string, unknown>): Observable<Project> {
    return this.api.patch(`projects/${id}/payments/${paymentId}`, body);
  }
  commissioning(id: string, body: Record<string, unknown>): Observable<Project> {
    return this.api.post(`projects/${id}/commissioning`, body);
  }
  handover(id: string, body: Record<string, unknown>): Observable<Project> {
    return this.api.post(`projects/${id}/handover`, body);
  }
  delay(id: string, body: { reason: string; days: number; phaseCode?: string }): Observable<Project> {
    return this.api.post(`projects/${id}/delays`, body);
  }
  customerUpdate(id: string, body: { channel: string; message: string }): Observable<Project> {
    return this.api.post(`projects/${id}/customer-updates`, body);
  }
}

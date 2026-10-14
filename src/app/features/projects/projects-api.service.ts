import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { CompletenessResult } from '../../shared/crm/completeness-panel/completeness-result.interface';
import type { Person, ProposalTeam } from '../proposals/proposals.models';
import type { WorkflowView } from '../../shared/crm/pipeline-tracker/workflow-view.interface';

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
  /** Absent without financial visibility (server-side projection). */
  payments?: Array<SubId & { name: string; pct: number; amount: number; trigger?: string; dueAt?: string | null; status: string; invoicedAt?: string | null; paidAt?: string | null }>;
  installationProgressPct: number;
  startDate?: string | null;
  targetEndDate?: string | null;
  closedAt?: string | null;
  contractValue?: number;
  kwp: number;
  storageKwh?: number;
  scope?: string;
  notes?: string;
  commissioning?: { testResults: Array<{ test: string; result: string; passed: boolean; notes?: string }>; commissionedAt?: string | null; utilityConnectionStatus?: string; netMeteringStatus?: string; notes?: string; acceptedBy?: string | null; acceptedAt?: string | null } | null;
  handover?: { documentIds: string[]; warranties: Array<{ item: string; provider?: string; years: number; startDate?: string | null }>; customerAcceptedAt?: string | null; acceptedByName?: string; notes?: string } | null;
  delays: Array<{ reason: string; days: number; phaseCode?: string; at: string; by: Person }>;
  isDelayed: boolean;
  customerUpdates: Array<{ at: string; channel: string; message: string; by: Person }>;
  proposalTeam: ProposalTeam;
  inherited: Record<string, unknown>;
  /** Approved scope baseline (changes only through change requests). */
  baseline?: { version: number; scope?: string; kwp?: number; storageKwh?: number; contractValue?: number; technicalProposalVersion?: number; contractVersion?: number } | null;
  readinessGates?: Record<string, { status: string; note?: string; riskAcceptedReason?: string; by?: string; at?: string } | undefined>;
  workOrders?: WorkOrder[];
  handoverId?: string | null;
}

export interface WorkOrder {
  id?: string;
  _id?: string;
  number: string;
  title: string;
  scope?: string;
  crewIds: string[];
  status: 'draft' | 'authorized' | 'in_progress' | 'completed' | 'cancelled';
  plannedStart?: string | null;
  plannedEnd?: string | null;
  authorizedBy?: string | null;
  authorizedAt?: string | null;
  safetyBriefingAt?: string | null;
  evidenceDocumentIds: string[];
}

export interface ChangeRequest {
  id: string;
  changeRequestNo: string;
  requesterId: string;
  reason: string;
  description: string;
  technicalImpact: string;
  safetyImpact: string;
  costImpact: number;
  marginImpact: number;
  scheduleImpactDays: number;
  revisedScope?: string;
  revisedKwp?: number;
  revisedContractValue?: number;
  customerAcceptanceRequired: boolean;
  customerAcceptance?: { documentId: string; acceptedAt: string } | null;
  approvals: Record<string, { required: boolean; decision?: 'approve' | 'reject' | null; by?: string | null; at?: string | null; note?: string }>;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'withdrawn';
  rejectionReason?: string | null;
  baselineVersionApplied?: number | null;
  createdAt: string;
}

export interface ProjectDetail {
  project: Project;
  completeness: CompletenessResult;
  /** Server-computed and scope-aware: PM plans, field roles execute, the Technical Lead accepts, Finance records payments. */
  permissions: { canManage: boolean; canExecute: boolean; canAcceptTechnically: boolean; canUpdatePayments: boolean };
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

  /** Delivery tracker: stage, history, blockers, control, what each move needs. */
  workflow(id: string): Observable<WorkflowView> {
    return this.api.get(`projects/${id}/workflow`);
  }
  transition(id: string, body: { action: string; reason?: string }): Observable<Project> {
    return this.api.post(`projects/${id}/transition`, body);
  }
  readiness(id: string, gate: string, body: { status: string; note?: string; riskAcceptedReason?: string }): Observable<Project> {
    return this.api.post(`projects/${id}/readiness/${gate}`, body);
  }
  createWorkOrder(id: string, body: { title: string; scope?: string; crewIds: string[]; plannedStart?: string; plannedEnd?: string }): Observable<Project> {
    return this.api.post(`projects/${id}/work-orders`, body);
  }
  authorizeWorkOrder(id: string, workOrderId: string): Observable<Project> {
    return this.api.post(`projects/${id}/work-orders/${workOrderId}/authorize`);
  }
  updateWorkOrder(id: string, workOrderId: string, body: { status?: 'in_progress' | 'completed'; safetyBriefingDone?: boolean; report?: { kind: string; text: string }; evidenceDocumentIds?: string[] }): Observable<Project> {
    return this.api.patch(`projects/${id}/work-orders/${workOrderId}`, body);
  }
  changeRequests(id: string): Observable<ChangeRequest[]> {
    return this.api.get(`projects/${id}/change-requests`);
  }
  createChangeRequest(id: string, body: Record<string, unknown>): Observable<ChangeRequest> {
    return this.api.post(`projects/${id}/change-requests`, body);
  }
  submitChangeRequest(changeRequestId: string): Observable<ChangeRequest> {
    return this.api.post(`change-requests/${changeRequestId}/submit`);
  }
  decideChangeRequest(changeRequestId: string, body: { role: 'technical' | 'pm' | 'commercial'; decision: 'approve' | 'reject'; note?: string }): Observable<ChangeRequest> {
    return this.api.post(`change-requests/${changeRequestId}/decisions`, body);
  }
  changeRequestAcceptance(changeRequestId: string, body: { documentId: string; acceptedAt: string }): Observable<ChangeRequest> {
    return this.api.post(`change-requests/${changeRequestId}/customer-acceptance`, body);
  }
}

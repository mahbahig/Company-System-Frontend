import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { AssignLeadsPayload } from './models/assign-leads-payload.interface';
import type { DistributeLeadsPayload } from './models/distribute-leads.interface';
import type { RoutingProposal } from './models/routing-proposal.interface';
import type { CloseLeadPayload } from './models/close-lead.interface';
import type { ConversionResult } from './models/conversion-result.interface';
import type { ConvertLeadPayload } from './models/convert-lead.interface';
import type { CreateLeadPayload } from './models/create-lead-payload.interface';
import type { UpdateLeadPayload } from './models/update-lead-payload.type';
import type { LeadDetail } from './models/lead-detail.interface';
import type { LeadListQuery } from './models/lead-list-query.interface';
import type { LeadTimelineEvent } from './models/lead-timeline-event.interface';
import type { Lead } from './models/lead.interface';
import type { LogAttemptPayload } from './models/log-attempt.interface';
import type { IdentityDecisionPayload } from './models/identity-decision.interface';
import type { QualificationPayload } from './models/qualification-payload.interface';
import type { WorkflowView } from '../../shared/crm/pipeline-tracker/workflow-view.interface';
import type { MyLeadsQuery } from './models/my-leads-query.interface';
import type { QuickAddLeadPayload } from './models/quick-add-lead.interface';

/** Typed client for `/leads` (Lead Bank, My Leads, lifecycle, assignment and conversion). */
@Service()
export class LeadsApi {
  private readonly api = inject(ApiService);

  bank(query: LeadListQuery): Observable<Page<Lead>> {
    return this.api.get<Page<Lead>>('leads', { ...query });
  }

  mine(query: MyLeadsQuery): Observable<Page<Lead>> {
    return this.api.get<Page<Lead>>('leads/mine', { ...query });
  }

  get(id: string): Observable<LeadDetail> {
    return this.api.get<LeadDetail>(`leads/${id}`);
  }

  create(payload: CreateLeadPayload): Observable<Lead> {
    return this.api.post<Lead>('leads', payload);
  }

  quickAdd(payload: QuickAddLeadPayload): Observable<Lead> {
    return this.api.post<Lead>('leads/quick-add', payload);
  }

  update(id: string, payload: UpdateLeadPayload): Observable<Lead> {
    return this.api.patch<Lead>(`leads/${id}`, payload);
  }

  logAttempt(id: string, payload: LogAttemptPayload): Observable<Lead> {
    return this.api.post<Lead>(`leads/${id}/attempts`, payload);
  }

  qualify(id: string, payload: QualificationPayload): Observable<Lead> {
    return this.api.post<Lead>(`leads/${id}/qualify`, payload);
  }

  /** L0–L5 tracker: stage, history, requirements, blockers, control. */
  workflow(id: string): Observable<WorkflowView> {
    return this.api.get<WorkflowView>(`leads/${id}/workflow`);
  }

  transition(id: string, action: 'start_identity_review' | 'log_two_way_contact', reason?: string): Observable<Lead> {
    return this.api.post<Lead>(`leads/${id}/transition`, reason ? { action, reason } : { action });
  }

  identityReview(id: string, payload: IdentityDecisionPayload): Observable<Lead> {
    return this.api.post<Lead>(`leads/${id}/identity-review`, payload);
  }

  submitHandoff(id: string, payload: { toUserId?: string; needSummary: string; recommendedNextAction: string; appointmentAt?: string; customerExpectations?: string }): Observable<Lead> {
    return this.api.post<Lead>(`leads/${id}/handoff`, payload);
  }

  acceptHandoff(id: string, payload: { firstAction: string; firstActionAt: string }): Observable<Lead> {
    return this.api.post<Lead>(`leads/${id}/handoff/accept`, payload);
  }

  returnHandoff(id: string, reason: string): Observable<Lead> {
    return this.api.post<Lead>(`leads/${id}/handoff/return`, { reason });
  }

  reassignHandoff(id: string, payload: { toUserId: string; reason: string }): Observable<Lead> {
    return this.api.post<Lead>(`leads/${id}/handoff/reassign`, payload);
  }

  close(id: string, payload: CloseLeadPayload): Observable<Lead> {
    return this.api.post<Lead>(`leads/${id}/close`, payload);
  }

  reopen(id: string, reason: string): Observable<Lead> {
    return this.api.post<Lead>(`leads/${id}/reopen`, { reason });
  }

  convert(id: string, payload: ConvertLeadPayload): Observable<ConversionResult> {
    return this.api.post<ConversionResult>(`leads/${id}/convert`, payload);
  }

  timeline(id: string): Observable<LeadTimelineEvent[]> {
    return this.api.get<LeadTimelineEvent[]>(`leads/${id}/timeline`);
  }

  assign(payload: AssignLeadsPayload): Observable<{ assigned: number }> {
    return this.api.post<{ assigned: number }>('leads/assign', payload);
  }

  previewDistribution(payload: DistributeLeadsPayload): Observable<{ proposals: RoutingProposal[] }> {
    return this.api.post<{ proposals: RoutingProposal[] }>('leads/distribute/preview', payload);
  }

  distribute(payload: DistributeLeadsPayload): Observable<{ assigned: number; unassigned: number }> {
    return this.api.post<{ assigned: number; unassigned: number }>('leads/distribute', payload);
  }
}

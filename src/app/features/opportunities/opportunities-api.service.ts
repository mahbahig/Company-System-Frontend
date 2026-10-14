import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { BoardColumn } from './models/board-column.interface';
import type { BoardQuery } from './models/board-query.interface';
import type { ChangeStagePayload } from './models/change-stage-payload.interface';
import type { CreateOpportunityPayload } from './models/create-opportunity-payload.interface';
import type { OpportunityFields } from './models/opportunity-fields.interface';
import type { OpportunityDetail } from './models/opportunity-detail.interface';
import type { OpportunityListQuery } from './models/opportunity-list-query.interface';
import type { Opportunity } from './models/opportunity.interface';
import type { UpdateTeamPayload } from './models/update-team-payload.interface';
import type { DeliveryHandover, DeliveryHandoverView } from './models/delivery-handover.interface';
import type { FieldFact } from './models/field-fact.interface';
import type { OpportunityWorkflow } from './models/opportunity-workflow.interface';

/** Typed client for the opportunities endpoints. */
@Service()
export class OpportunitiesApi {
  private readonly api = inject(ApiService);

  list(query: OpportunityListQuery): Observable<Page<Opportunity>> {
    return this.api.get<Page<Opportunity>>('opportunities', { ...query });
  }

  /** OPP-04 pipeline board: one column per open stage. */
  board(query: BoardQuery): Observable<{ columns: BoardColumn[] }> {
    return this.api.get<{ columns: BoardColumn[] }>('opportunities/board', { ...query });
  }

  get(id: string): Observable<OpportunityDetail> {
    return this.api.get<OpportunityDetail>(`opportunities/${id}`);
  }

  create(payload: CreateOpportunityPayload): Observable<Opportunity> {
    return this.api.post<Opportunity>('opportunities', payload);
  }

  update(id: string, payload: Partial<OpportunityFields>): Observable<Opportunity> {
    return this.api.patch<Opportunity>(`opportunities/${id}`, payload);
  }

  changeStage(id: string, payload: ChangeStagePayload): Observable<Opportunity> {
    return this.api.post<Opportunity>(`opportunities/${id}/stage`, payload);
  }

  changeOutcome(
    id: string,
    payload: { outcome: 'on_hold' | 'nurture' | 'cancelled' | 'open'; reason: string; blocker?: string; holdOwnerId?: string; reviewAt?: string; buyingWindow?: string; followUpAt?: string },
  ): Observable<Opportunity> {
    return this.api.post<Opportunity>(`opportunities/${id}/outcome`, payload);
  }

  changeOwner(id: string, payload: { ownerId: string; reason: string }): Observable<Opportunity> {
    return this.api.post<Opportunity>(`opportunities/${id}/owner`, payload);
  }

  addCollaborator(id: string, payload: { userId: string; role: string; isTechnicalPoc: boolean }): Observable<Opportunity> {
    return this.api.post<Opportunity>(`opportunities/${id}/collaborators`, payload);
  }

  removeCollaborator(id: string, userId: string): Observable<Opportunity> {
    return this.api.delete<Opportunity>(`opportunities/${id}/collaborators/${userId}`);
  }

  /** OPP-09 team assignments (PM, engineer, tech lead, financial preparer). */
  updateTeam(id: string, payload: UpdateTeamPayload): Observable<Opportunity> {
    return this.api.patch<Opportunity>(`opportunities/${id}/team`, payload);
  }

  markReadiness(id: string, itemId: string, done: boolean): Observable<Opportunity> {
    return this.api.post<Opportunity>(`opportunities/${id}/readiness`, { itemId, done });
  }

  /** O-stage and deal trackers: stage, history, requirements, blockers, control. */
  workflow(id: string): Observable<OpportunityWorkflow> {
    return this.api.get<OpportunityWorkflow>(`opportunities/${id}/workflow`);
  }

  /** O1 discovery facts (merged), each with its explicit state. */
  discovery(id: string, facts: Record<string, FieldFact>): Observable<Opportunity> {
    return this.api.put<Opportunity>(`opportunities/${id}/discovery`, { facts });
  }

  addRisk(id: string, body: { description: string; category?: string; severity?: string; mitigation?: string }): Observable<Opportunity> {
    return this.api.post<Opportunity>(`opportunities/${id}/risks`, body);
  }

  raiseBlocker(id: string, body: { code: string; description: string; severity?: string; ownerId: string; dueAt: string }): Observable<Opportunity> {
    return this.api.post<Opportunity>(`opportunities/${id}/blockers`, body);
  }

  resolveBlocker(id: string, blockerId: string, resolution: string): Observable<Opportunity> {
    return this.api.post<Opportunity>(`opportunities/${id}/blockers/${blockerId}/resolve`, { resolution });
  }

  financeHold(id: string, body: { active: boolean; reasonCode?: string; note?: string }): Observable<Opportunity> {
    return this.api.post<Opportunity>(`opportunities/${id}/deal/finance-hold`, body);
  }

  financeReadiness(id: string, body: { depositStatus: string; note?: string; evidenceDocumentId?: string }): Observable<Opportunity> {
    return this.api.post<Opportunity>(`opportunities/${id}/deal/finance-readiness`, body);
  }

  // H0 → H1 Sales → Delivery handover --------------------------------------------

  deliveryHandover(id: string): Observable<DeliveryHandoverView> {
    return this.api.get<DeliveryHandoverView>(`opportunities/${id}/delivery-handover`);
  }

  updateHandoverPack(id: string, pack: Record<string, unknown>): Observable<DeliveryHandover> {
    return this.api.patch<DeliveryHandover>(`opportunities/${id}/delivery-handover/pack`, pack);
  }

  submitHandover(id: string): Observable<DeliveryHandover> {
    return this.api.post<DeliveryHandover>(`opportunities/${id}/delivery-handover/submit`);
  }

  confirmHandover(id: string, body: { kind: 'design_baseline' | 'financial_readiness' | 'won_evidence'; note?: string; depositStatus?: string; evidenceDocumentId?: string }): Observable<DeliveryHandover> {
    return this.api.post<DeliveryHandover>(`opportunities/${id}/delivery-handover/confirmations`, body);
  }

  acceptHandover(id: string, note?: string): Observable<{ handover: DeliveryHandover; project: { id: string; projectNo: string } }> {
    return this.api.post(`opportunities/${id}/delivery-handover/accept`, note ? { note } : {});
  }

  returnHandover(id: string, body: { reason: string; items: string[] }): Observable<DeliveryHandover> {
    return this.api.post<DeliveryHandover>(`opportunities/${id}/delivery-handover/return`, body);
  }
}

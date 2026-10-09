import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { BoardColumn } from './models/board-column.interface';
import type { BoardQuery } from './models/board-query.interface';
import type { ChangeStagePayload } from './models/change-stage-payload.interface';
import type { CreateOpportunityPayload } from './models/create-opportunity-payload.interface';
import type { GateEvaluation } from './models/gate-evaluation.interface';
import type { OpportunityFields } from './models/opportunity-fields.interface';
import type { OpportunityDetail } from './models/opportunity-detail.interface';
import type { OpportunityListQuery } from './models/opportunity-list-query.interface';
import type { Opportunity } from './models/opportunity.interface';
import type { UpdateTeamPayload } from './models/update-team-payload.interface';

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

  /** Section 7.6: preview the gates for a target stage before offering it. */
  gates(id: string, toStage: string): Observable<GateEvaluation> {
    return this.api.get<GateEvaluation>(`opportunities/${id}/gates`, { to: toStage });
  }

  changeStage(id: string, payload: ChangeStagePayload): Observable<Opportunity> {
    return this.api.post<Opportunity>(`opportunities/${id}/stage`, payload);
  }

  changeOutcome(id: string, payload: { outcome: 'on_hold' | 'cancelled' | 'open'; reason: string }): Observable<Opportunity> {
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
}

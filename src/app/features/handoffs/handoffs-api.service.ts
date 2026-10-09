import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { UserRef } from '../../core/auth/models/user-ref.interface';
import type { CompletenessItem } from '../../shared/crm/completeness-panel/completeness-item.interface';
import type { CompletenessResult } from '../../shared/crm/completeness-panel/completeness-result.interface';

export interface HandoffOpportunityRef {
  id: string;
  opportunityNo: string;
  name: string;
  stage: string;
  solutionTypeCode?: string;
  customerId?: { id: string; customerNo: string; nameAr?: string; nameEn?: string } | string;
  ownerId?: UserRef | string;
}

export interface Handoff {
  id?: string;
  handoffNo?: string;
  opportunityId: HandoffOpportunityRef | string;
  status: string;
  versions: Array<{ version: number; submittedBy: UserRef | string; submittedAt: string; overrideReason?: string | null; missingAtSubmit: string[] }>;
  resubmissionCount: number;
  submittedBy?: UserRef | string | null;
  submittedAt?: string | null;
  decidedAt?: string | null;
  returnReason?: string | null;
  returnMissingItemIds: string[];
  clarifications: Array<{ askedBy: UserRef | string; askedAt: string; question: string; answeredBy?: UserRef | string | null; answeredAt?: string | null; answer?: string | null }>;
  returns?: Array<{ by: UserRef | string; at: string; reason: string; missingItemIds: string[] }>;
  receivingUserId?: UserRef | string | null;
  acceptedAt?: string | null;
  firstPassAccepted?: boolean | null;
  slaDueAt?: string | null;
  slaBreachedAt?: string | null;
  resubmitDueAt?: string | null;
  withdrawnReason?: string | null;
}

export interface HandoffView {
  handoff: Handoff;
  readiness: { ready: boolean; missing: Array<CompletenessItem & { entity: 'handoff' | 'site' }>; completeness: CompletenessResult };
}

/** Typed client for the Sales → PM/Technical handoff (HAND-01..08). */
@Service()
export class HandoffsApi {
  private readonly api = inject(ApiService);

  inbox(query: { status?: string; all?: boolean; mine?: boolean; overdue?: boolean; page?: number; q?: string }): Observable<Page<Handoff>> {
    return this.api.get('handoffs', query);
  }

  get(opportunityId: string): Observable<HandoffView> {
    return this.api.get(`handoffs/opportunity/${opportunityId}`);
  }

  submit(opportunityId: string, overrideReason?: string): Observable<Handoff> {
    return this.api.post(`handoffs/opportunity/${opportunityId}/submit`, { overrideReason });
  }

  withdraw(opportunityId: string, reason: string): Observable<Handoff> {
    return this.api.post(`handoffs/opportunity/${opportunityId}/withdraw`, { reason });
  }

  accept(opportunityId: string, body: { engineerId: string; techLeadId?: string | null }): Observable<Handoff> {
    return this.api.post(`handoffs/opportunity/${opportunityId}/accept`, body);
  }

  returnForInformation(opportunityId: string, body: { reason: string; missingItemIds: string[] }): Observable<Handoff> {
    return this.api.post(`handoffs/opportunity/${opportunityId}/return`, body);
  }

  clarify(opportunityId: string, question: string): Observable<Handoff> {
    return this.api.post(`handoffs/opportunity/${opportunityId}/clarify`, { question });
  }

  answer(opportunityId: string, answer: string): Observable<Handoff> {
    return this.api.post(`handoffs/opportunity/${opportunityId}/clarify/answer`, { answer });
  }
}

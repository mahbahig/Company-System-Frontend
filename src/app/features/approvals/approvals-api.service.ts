import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { UserRef } from '../../core/auth/models/user-ref.interface';

export interface Approval {
  id: string;
  approvalNo: string;
  type: string;
  entityType: string;
  entityId: string;
  opportunityId?: string | null;
  customerId?: string | null;
  subject: string;
  actionUrl?: string;
  requesterId: UserRef | string;
  approverRole: string;
  approverIds: Array<UserRef | string>;
  reasons: string[];
  originalValue?: Record<string, unknown> | null;
  requestedValue?: Record<string, unknown> | null;
  keyFigures: Record<string, unknown>;
  requestNote?: string | null;
  status: string;
  decision?: { decision: string; by: UserRef | string; onBehalfOf?: UserRef | string | null; at: string; reason?: string | null; comment?: string | null } | null;
  comments: Array<{ by: UserRef | string; at: string; text: string }>;
  dueAt: string;
  escalationLevel: number;
  /** Inbox only: the approver this user stands in for as a delegate (USER-06). */
  onBehalfOf?: UserRef | string | null;
  closedAt?: string | null;
  createdAt: string;
}

export interface Delegation {
  delegateId: string;
  from: string;
  to: string;
}

/** Typed client for the approval workflow (APPR-01..04, USER-06). */
@Service()
export class ApprovalsApi {
  private readonly api = inject(ApiService);

  list(query: { box?: string; status?: string; type?: string; page?: number; entityType?: string; entityId?: string; opportunityId?: string }): Observable<Page<Approval>> {
    return this.api.get('approvals', query);
  }

  counts(): Observable<{ total: number; byType: Record<string, number>; overdue: number }> {
    return this.api.get('approvals/counts');
  }

  get(id: string): Observable<{ approval: Approval; canDecide: boolean }> {
    return this.api.get(`approvals/${id}`);
  }

  decide(id: string, body: { decision: 'approve' | 'reject' | 'return'; reason?: string; comment?: string }): Observable<Approval> {
    return this.api.post(`approvals/${id}/decide`, body);
  }

  comment(id: string, text: string): Observable<Approval> {
    return this.api.post(`approvals/${id}/comments`, { text });
  }

  delegations(): Observable<{ delegations: Delegation[] }> {
    return this.api.get('approvals/delegations');
  }

  setDelegations(delegations: Delegation[]): Observable<{ delegations: Delegation[] }> {
    return this.api.put('approvals/delegations', { delegations });
  }
}

import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type {
  CombinedProposal,
  CombinedProposalDetail,
  CostLine,
  FinancialProposal,
  FinancialProposalDetail,
  FinancingOption,
  NegotiationEvent,
  PaymentMilestone,
  RegisterRow,
  RevisionRequest,
  TechnicalProposal,
  TechnicalProposalDetail,
} from './proposals.models';

type ListQuery = { status?: string; opportunityId?: string; customerId?: string; mine?: boolean; customerFacing?: boolean; page?: number; pageSize?: number; q?: string };

/** Typed client for technical, financial and combined proposals, the register, revisions and negotiations. */
@Service()
export class ProposalsApi {
  private readonly api = inject(ApiService);

  // Technical (TPROP)
  technicalList(query: ListQuery): Observable<Page<TechnicalProposal>> {
    return this.api.get('technical-proposals', query);
  }
  technical(id: string): Observable<TechnicalProposalDetail> {
    return this.api.get(`technical-proposals/${id}`);
  }
  createTechnical(body: { opportunityId: string; changeReason?: string; revisionRequestId?: string }): Observable<TechnicalProposal> {
    return this.api.post('technical-proposals', body);
  }
  updateTechnical(id: string, body: Partial<TechnicalProposal>): Observable<TechnicalProposal> {
    return this.api.patch(`technical-proposals/${id}`, body);
  }
  submitTechnical(id: string): Observable<TechnicalProposal> {
    return this.api.post(`technical-proposals/${id}/submit`);
  }
  /** O3: approve, approve with (recorded) conditions, reject with findings (never costed or quoted), or return for rework. */
  decideTechnical(id: string, body: { decision: 'approve' | 'approve_with_conditions' | 'reject' | 'return'; reason?: string; conditions?: string }): Observable<TechnicalProposal> {
    return this.api.post(`technical-proposals/${id}/decide`, body);
  }

  // Financial (FPROP)
  financialList(query: ListQuery): Observable<Page<FinancialProposal>> {
    return this.api.get('financial-proposals', query);
  }
  financial(id: string): Observable<FinancialProposalDetail> {
    return this.api.get(`financial-proposals/${id}`);
  }
  createFinancial(body: { technicalProposalId: string; changeReason?: string; revisionRequestId?: string }): Observable<FinancialProposal> {
    return this.api.post('financial-proposals', body);
  }
  updateFinancial(
    id: string,
    body: Partial<{ costLines: CostLine[]; contingencyPct: number; listPrice: number; discountPct: number; discountReason: string; vatPct: number; paymentMilestones: PaymentMilestone[]; financingOptions: FinancingOption[]; exchangeRates: Record<string, number>; validityDays: number; commercialTerms: string; specialTerms: string }>,
  ): Observable<FinancialProposal> {
    return this.api.patch(`financial-proposals/${id}`, body);
  }
  submitFinancial(id: string): Observable<FinancialProposal> {
    return this.api.post(`financial-proposals/${id}/submit`);
  }

  // Combined (PROP)
  combinedList(query: ListQuery): Observable<Page<CombinedProposal>> {
    return this.api.get('combined-proposals', query);
  }
  combined(id: string): Observable<CombinedProposalDetail> {
    return this.api.get(`combined-proposals/${id}`);
  }
  register(opportunityId: string): Observable<{ opportunityId: string; rows: RegisterRow[] }> {
    return this.api.get(`combined-proposals/register/${opportunityId}`);
  }
  history(opportunityId: string): Observable<{ rows: Array<Record<string, unknown>> }> {
    return this.api.get(`combined-proposals/history/${opportunityId}`);
  }
  compare(a: string, b: string): Observable<{ a: Record<string, unknown>; b: Record<string, unknown>; differences: string[] }> {
    return this.api.get('combined-proposals/compare', { a, b });
  }
  createCombined(body: { technicalProposalId: string; financialProposalId: string; templateCode?: string; language?: string; title?: string; introduction?: string; customerNotes?: string; terms?: string; changeReason?: string; revisionRequestId?: string }): Observable<CombinedProposal> {
    return this.api.post('combined-proposals', body);
  }
  updateCombined(id: string, body: Partial<Pick<CombinedProposal, 'templateCode' | 'language' | 'title' | 'introduction' | 'customerNotes' | 'terms'>>): Observable<CombinedProposal> {
    return this.api.patch(`combined-proposals/${id}`, body);
  }
  generate(id: string): Observable<CombinedProposal> {
    return this.api.post(`combined-proposals/${id}/generate`);
  }
  attachDocument(id: string, documentId: string): Observable<CombinedProposal> {
    return this.api.post(`combined-proposals/${id}/document`, { documentId });
  }
  submitCombined(id: string): Observable<CombinedProposal> {
    return this.api.post(`combined-proposals/${id}/submit`);
  }
  /** O5 → O6: the exact version, recipients, channel, timestamp and the next follow-up are kept. */
  deliver(id: string, body: { channel: string; at?: string; recipients: string[]; presenterIds?: string[]; notes?: string; nextFollowUpAt: string }): Observable<CombinedProposal> {
    return this.api.post(`combined-proposals/${id}/deliver`, body);
  }
  feedback(id: string, body: { response: string; feedback?: string; questions?: string; requestedModifications?: string; nextAction?: string; nextActionAt?: string }): Observable<CombinedProposal> {
    return this.api.post(`combined-proposals/${id}/feedback`, body);
  }
  /** O8: the customer accepted this exact version, proven by evidence attached to it. */
  accept(
    id: string,
    body: { acceptedVersionNo: number; evidenceType: 'signed_quotation' | 'written_acceptance' | 'purchase_order' | 'approved_equivalent'; documentId: string; acceptedAt: string; contractingParty: string; signatoryName: string; signatoryTitle?: string; purchaseOrderNo?: string; approvalId?: string },
  ): Observable<CombinedProposal> {
    return this.api.post(`combined-proposals/${id}/accept`, body);
  }
  markFinal(id: string): Observable<CombinedProposal> {
    return this.api.post(`combined-proposals/${id}/final`);
  }
  requestResend(id: string): Observable<unknown> {
    return this.api.post(`combined-proposals/${id}/resend-request`);
  }
  share(id: string, body: { channel: 'email' | 'whatsapp' | 'portal'; recipients: string[]; expiresInDays?: number; message?: string }): Observable<{ url: string; expiresAt: string }> {
    return this.api.post(`combined-proposals/${id}/share`, body);
  }

  // Revision requests (PROP-18..20)
  revisions(query: ListQuery): Observable<Page<RevisionRequest>> {
    return this.api.get('revision-requests', query);
  }
  createRevision(body: { combinedProposalId: string; type: string; details: string; negotiationEventId?: string }): Observable<RevisionRequest> {
    return this.api.post('revision-requests', body);
  }
  startRevision(id: string): Observable<RevisionRequest> {
    return this.api.post(`revision-requests/${id}/start`);
  }
  rejectRevision(id: string, reason: string): Observable<RevisionRequest> {
    return this.api.post(`revision-requests/${id}/reject`, { reason });
  }

  // Negotiations (NEG)
  negotiations(query: { opportunityId?: string; page?: number }): Observable<Page<NegotiationEvent>> {
    return this.api.get('negotiations', query);
  }
  createNegotiation(body: Record<string, unknown>): Observable<NegotiationEvent> {
    return this.api.post('negotiations', body);
  }
  negotiationOutcome(id: string, body: { outcome: string; outcomeNotes?: string; internalNotes?: string; customerNotes?: string }): Observable<NegotiationEvent> {
    return this.api.patch(`negotiations/${id}/outcome`, body);
  }
}

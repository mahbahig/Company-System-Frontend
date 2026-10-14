import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { CompletenessResult } from '../../shared/crm/completeness-panel/completeness-result.interface';
import type { PaymentMilestone, Person, ProposalTeam } from '../proposals/proposals.models';

export interface Contract {
  id: string;
  contractNo: string;
  versionNo: number;
  versions?: Array<{ versionNo: number; changeReason?: string; at?: string }>;
  opportunityId: { id: string; opportunityNo: string; name: string; stage?: string; outcome?: string } | string;
  customerId: { id: string; customerNo: string; nameAr?: string; nameEn?: string } | string;
  combinedProposalId: string;
  proposalVersion: number;
  status: string;
  value: number;
  valueExVat: number;
  vatPct: number;
  currency: string;
  scope?: string;
  paymentMilestones: PaymentMilestone[];
  contractDate?: string | null;
  validUntil?: string | null;
  requiredDocuments: Array<{ code: string; nameAr: string; nameEn: string; received: boolean; documentId?: string | null; receivedAt?: string | null }>;
  signatories: Array<{ party: 'customer' | 'company'; name: string; title?: string; email?: string; signedAt?: string | null }>;
  customerSignedAt?: string | null;
  companySignedAt?: string | null;
  proposalTeam: ProposalTeam;
  templateCode: string;
  language: string;
  documentId?: string | null;
  specialTerms?: string;
  notes?: string;
  approvedAt?: string | null;
  sentForSignatureAt?: string | null;
  executedAt?: string | null;
  terminationReason?: string | null;
  projectId?: string | null;
  createdAt?: string;
  legalName?: string;
  exclusions?: string;
  warranty?: string;
  delivery?: string;
  /** D4 confirmations, each bound to the contract version it confirms. */
  scopeConfirmation?: { versionNo: number; by: string; at: string; note?: string } | null;
  paymentTermsVerification?: { versionNo: number; by: string; at: string; note?: string } | null;
  technicalBaseline?: { technicalProposalId: string; technicalProposalVersion: number } | null;
  sentVersionNo?: number | null;
  signedDocumentId?: string | null;
}

export interface ContractDetail {
  contract: Contract;
  approvals: Array<{ id: string; approvalNo: string; status: string }>;
  completeness: CompletenessResult;
  permissions: {
    canEdit: boolean;
    canSubmit: boolean;
    canSend: boolean;
    canSignCustomer: boolean;
    canSignCompany: boolean;
    canTerminate: boolean;
    canConfirmScope?: boolean;
    canVerifyPaymentTerms?: boolean;
  };
}

export type { Person };

/** Typed client for contracts (CONTR-01..08). */
@Service()
export class ContractsApi {
  private readonly api = inject(ApiService);

  list(query: { status?: string; pending?: boolean; q?: string; page?: number; opportunityId?: string; customerId?: string }): Observable<Page<Contract>> {
    return this.api.get('contracts', query);
  }
  get(id: string): Observable<ContractDetail> {
    return this.api.get(`contracts/${id}`);
  }
  create(opportunityId: string): Observable<Contract> {
    return this.api.post('contracts', { opportunityId });
  }
  update(id: string, body: Record<string, unknown>): Observable<Contract> {
    return this.api.patch(`contracts/${id}`, body);
  }
  document(id: string, body: { code: string; received: boolean; documentId?: string }): Observable<Contract> {
    return this.api.post(`contracts/${id}/documents`, body);
  }
  generate(id: string): Observable<Contract> {
    return this.api.post(`contracts/${id}/generate`);
  }
  submit(id: string): Observable<Contract> {
    return this.api.post(`contracts/${id}/submit`);
  }
  send(id: string): Observable<Contract> {
    return this.api.post(`contracts/${id}/send`);
  }
  /** D4: the Technical Lead confirms the scope matches the approved baseline (this version). */
  confirmScope(id: string, note?: string): Observable<Contract> {
    return this.api.post(`contracts/${id}/confirm-scope`, note ? { note } : {});
  }
  /** D4: Finance verifies the payment terms (this version). */
  verifyPaymentTerms(id: string, note?: string): Observable<Contract> {
    return this.api.post(`contracts/${id}/verify-payment-terms`, note ? { note } : {});
  }
  /** Every party signs the same version; the company signature attaches the signed document (the Won evidence). */
  sign(id: string, body: { party: 'customer' | 'company'; signedAt?: string; signatoryName: string; signatoryTitle?: string; versionNo: number; signedDocumentId?: string }): Observable<Contract> {
    return this.api.post(`contracts/${id}/signatures`, body);
  }
  terminate(id: string, reason: string): Observable<Contract> {
    return this.api.post(`contracts/${id}/terminate`, { reason });
  }
}

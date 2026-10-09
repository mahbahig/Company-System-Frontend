import type { UserRef } from '../../core/auth/models/user-ref.interface';
import type { CompletenessResult } from '../../shared/crm/completeness-panel/completeness-result.interface';
import type { BomItem, SystemDesign } from '../solar/solar.models';

export type Person = UserRef | string | null | undefined;

export interface TechnicalProposal {
  id: string;
  number: string;
  versionNo: number;
  opportunityId: string;
  status: string;
  authorId: Person;
  reviewerId?: Person;
  assessmentId?: string | null;
  capacityKwp?: number;
  storageKwh?: number;
  design: SystemDesign;
  equipment: BomItem[];
  bom: BomItem[];
  expectedAnnualGenerationKwh?: number;
  specificYield?: number;
  performanceRatio?: number;
  scope?: string;
  assumptions?: string;
  exclusions?: string;
  technicalTerms?: string;
  warranties?: string;
  changeReason?: string | null;
  submittedAt?: string | null;
  decidedAt?: string | null;
  decisionReason?: string | null;
  lockedAt?: string | null;
}

export interface TechnicalProposalDetail {
  proposal: TechnicalProposal;
  versions: Array<Pick<TechnicalProposal, 'id' | 'number' | 'versionNo' | 'status' | 'submittedAt' | 'decidedAt' | 'changeReason' | 'capacityKwp'>>;
  completeness: CompletenessResult;
  canEdit: boolean;
  canReview: boolean;
}

export interface CostLine {
  category: string;
  description: string;
  equipmentId?: string | null;
  model?: string;
  quantity: number;
  unit?: string;
  unitCost: number;
  currency: 'EGP' | 'USD' | 'EUR';
  totalEgp?: number;
}

export interface PaymentMilestone {
  name: string;
  pct: number;
  amount?: number;
  trigger?: string;
  dueDays?: number;
}

export interface FinancingOption {
  provider?: string;
  termMonths?: number;
  interestPct?: number;
  notes?: string;
}

export interface FinancialProposal {
  id: string;
  number: string;
  versionNo: number;
  opportunityId: string;
  technicalProposalId: { id: string; number: string; versionNo: number; capacityKwp?: number; status: string } | string;
  technicalProposalVersion: number;
  status: string;
  preparerId: Person;
  approverId?: Person;
  costLines?: CostLine[];
  subtotalCost?: number;
  contingencyPct?: number;
  contingencyAmount?: number;
  totalCost?: number;
  listPrice: number;
  /** The preparer typed this list price; otherwise it follows costs and the target margin. */
  listPriceManual?: boolean;
  discountPct: number;
  discountAmount: number;
  discountReason?: string | null;
  finalPrice: number;
  vatPct: number;
  vatAmount: number;
  totalWithVat: number;
  marginAmount?: number;
  marginPct?: number;
  paymentMilestones: PaymentMilestone[];
  downPaymentPct: number;
  financingOptions: FinancingOption[];
  currency: string;
  exchangeRates: Record<string, number>;
  validityDays: number;
  commercialTerms?: string;
  specialTerms?: string;
  approvalReasons: string[];
  changeReason?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  decisionReason?: string | null;
}

export interface FinancialProposalDetail {
  proposal: FinancialProposal;
  versions: Array<Pick<FinancialProposal, 'id' | 'number' | 'versionNo' | 'status' | 'finalPrice' | 'discountPct' | 'marginPct' | 'submittedAt' | 'approvedAt' | 'changeReason'>>;
  approvals: Array<{ id: string; approvalNo: string; status: string; type: string; approverRole: string }>;
  completeness: CompletenessResult;
  suggestedListPrice?: number;
  canEdit?: boolean;
  canSeeCost?: boolean;
}

export interface ProposalTeam {
  technicalAuthorId?: Person;
  technicalReviewerId?: Person;
  financialPreparerId?: Person;
  financialApproverId?: Person;
  assemblerId?: Person;
  finalApproverId?: Person;
  presenterId?: Person;
}

export interface CombinedProposal {
  id: string;
  proposalNo: string;
  versionNo: number;
  opportunityId: string;
  technicalProposalId: { id: string; number: string; versionNo: number; status: string; capacityKwp?: number; scope?: string } | string;
  financialProposalId: { id: string; number: string; versionNo: number; status: string } | string;
  status: string;
  templateCode: string;
  language: string;
  title?: string;
  introduction?: string;
  customerNotes?: string;
  terms?: string;
  documentId?: string | null;
  documentSource?: 'generated' | 'uploaded' | null;
  kwp: number;
  storageKwh?: number;
  listPrice: number;
  discountPct: number;
  price: number;
  vatPct: number;
  priceWithVat: number;
  paymentMilestones: PaymentMilestone[];
  validityDays: number;
  validUntil?: string | null;
  team: ProposalTeam;
  submittedAt?: string | null;
  approvedAt?: string | null;
  releasedAt?: string | null;
  customerFacing: boolean;
  isFinal: boolean;
  deliveries: Array<{ at: string; channel: string; recipients: string[]; presenterIds: Person[]; notes?: string }>;
  feedback: Array<{ at: string; response: string; feedback?: string; questions?: string; requestedModifications?: string; nextAction?: string; nextActionAt?: string | null }>;
  customerResponse?: string | null;
  changeReason?: string | null;
  decisionReason?: string | null;
}

export interface CombinedProposalDetail {
  proposal: CombinedProposal;
  versions: Array<Pick<CombinedProposal, 'id' | 'proposalNo' | 'versionNo' | 'status' | 'price' | 'discountPct' | 'kwp' | 'customerFacing' | 'isFinal' | 'releasedAt' | 'validUntil' | 'changeReason'>>;
  approvals: Array<{ id: string; approvalNo: string; status: string; type: string; approverRole: string }>;
  expired: boolean;
  completeness: CompletenessResult;
  permissions: { canEdit: boolean; canSubmit: boolean; canDeliver: boolean; canRecordFeedback: boolean; canMarkFinal: boolean; canRequestRevision: boolean; canRequestResend: boolean };
  opportunity: { id?: string; _id?: string; opportunityNo: string; name: string };
}

export interface RegisterRow {
  id?: string;
  _id?: string;
  proposalNo: string;
  versionNo: number;
  firstSentAt?: string | null;
  deliveries: Array<{ at: string; channel: string; recipients: string[]; presenters: Person[] }>;
  technicalAuthor?: Person;
  financialPreparer?: Person;
  approver?: Person;
  presenter?: Person;
  price: number;
  priceWithVat: number;
  kwp: number;
  discountPct: number;
  validUntil?: string | null;
  expired: boolean;
  customerResponse?: string | null;
  status: string;
  isFinal: boolean;
  documentId?: string | null;
}

export interface RevisionRequest {
  id: string;
  opportunityId: string;
  combinedProposalId: string | { id: string; proposalNo: string; versionNo: number };
  type: string;
  details: string;
  requestedBy: Person;
  status: string;
  resultingProposalId?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  closedAt?: string | null;
}

export interface NegotiationEvent {
  id: string;
  opportunityId: string;
  combinedProposalId?: string | null;
  proposalVersion?: number | null;
  typeCode: string;
  originalValue?: unknown;
  requestedValue?: unknown;
  valueUnit: string;
  objections?: string;
  competitor?: { code?: string; name?: string; offer?: string };
  approvalRequired: boolean;
  approvalReasons: string[];
  outcome: string;
  outcomeNotes?: string;
  internalNotes?: string;
  customerNotes?: string;
  loggedBy: Person;
  at: string;
}

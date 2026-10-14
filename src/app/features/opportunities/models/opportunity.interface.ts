import type { UserRef } from '../../../core/auth/models/user-ref.interface';
import type { Collaborator } from './collaborator.interface';
import type { Deal } from './deal.interface';
import type { FieldFact } from './field-fact.interface';
import type { OpportunityRisk } from './opportunity-risk.interface';
import type { ContactRef } from './contact-ref.interface';
import type { CustomerRef } from './customer-ref.interface';
import type { OpportunityHealth } from './opportunity-health.interface';
import type { OpportunityTeam } from './opportunity-team.interface';
import type { SiteRef } from './site-ref.interface';
import type { StageHistoryEntry } from './stage-history-entry.interface';

/** An opportunity (backend `opportunities`). List rows and the detail record share this shape. */
export interface Opportunity {
  id: string;
  opportunityNo: string;
  name: string;
  customerId: CustomerRef | string;
  primaryContactId?: ContactRef | string | null;
  /** CONT-02 contacts involved in this deal with their role. */
  contactRoles?: Array<{ contactId: string; role: string; note?: string }>;
  projectId?: string | null;
  siteId?: SiteRef | string | null;
  ownerId: UserRef | string | null;
  team?: OpportunityTeam;
  collaborators?: Collaborator[];
  /** `pipeline_stage` reference code. */
  stage: string;
  stageEnteredAt?: string;
  stageHistory?: StageHistoryEntry[];
  outcome: 'open' | 'won' | 'lost' | 'cancelled' | 'on_hold' | 'nurture';
  /** O1 discovery facts, each with its explicit state. */
  discovery?: Record<string, FieldFact>;
  risks?: OpportunityRisk[];
  deal?: Deal | null;
  useCase?: string;
  needConfirmation?: { method: string; note: string; confirmedAt: string } | null;
  acceptance?: { proposalId: string; proposalVersion: number; evidenceType: string; documentId: string; acceptedAt: string } | null;
  lostReason?: { code: string; competitorCode?: string; competitorName?: string; comment?: string } | null;
  closedAt?: string | null;
  probability: number;
  solutionTypeCode?: string;
  serviceTypeCode?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  currency?: string;
  estimatedValue?: number;
  proposalValue?: number;
  contractValue?: number;
  estimatedKwp?: number;
  storageKwh?: number;
  expectedCloseDate?: string | null;
  competitorCodes?: string[];
  competitorNotes?: string;
  nextAction?: string;
  nextActionAt?: string | null;
  lastActivityAt?: string | null;
  leadSourceCode?: string;
  campaignCode?: string;
  health?: OpportunityHealth;
  intakeStatus?: string;
  handoffStatus?: string;
  proposalStatus?: string;
  contractStatus?: string;
  notes?: string;
  completenessScore?: number;
  createdAt: string;
  updatedAt: string;
}

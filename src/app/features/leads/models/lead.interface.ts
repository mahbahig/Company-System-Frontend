import type { UserRef } from '../../../core/auth/models/user-ref.interface';
import type { Qualification } from './qualification.interface';

/** A lead in the Central Lead Bank (backend `leads`), as list/detail endpoints return it. */
export interface Lead {
  id: string;
  leadNo: string;
  name: string;
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  altPhone?: string;
  email?: string;
  governorateCode?: string;
  cityCode?: string;
  addressLine?: string;
  categoryCode?: string;
  sectorCode?: string;
  requestedServiceCode?: string;
  solutionTypeCode?: string;
  sourceCode: string;
  intakeMode: 'self_sourced' | 'bank';
  campaignCode?: string;
  referrer?: { type?: string; name?: string; customerId?: string | null; phone?: string };
  ownerId: UserRef | string | null;
  teamId?: string | null;
  assignedAt?: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'nurture' | 'converted' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  qualification?: Qualification;
  estimatedValue?: number;
  qualityCode?: string;
  sla: {
    startedAt?: string | null;
    dueAt?: string | null;
    firstContactAt?: string | null;
    breachedAt?: string | null;
  };
  /** Derived server-side: on_track / due_soon / breached / met / not_started. */
  slaState: 'on_track' | 'due_soon' | 'breached' | 'met' | 'not_started';
  openedAt?: string | null;
  contactAttempts: number;
  lastContactAttemptAt?: string | null;
  qualifiedAt?: string | null;
  closure?: { reason: string; comment?: string; closedAt: string; closedBy: UserRef | string } | null;
  conversion?: {
    customerId: string;
    contactId?: string | null;
    siteId?: string | null;
    opportunityId?: string | null;
    linkedExistingCustomer: boolean;
    convertedAt: string;
    convertedBy: UserRef | string;
  } | null;
  nextFollowUpAt?: string | null;
  nextAction?: string;
  lastActivityAt?: string | null;
  notes?: string;
  completenessScore: number;
  createdAt: string;
  updatedAt: string;
}

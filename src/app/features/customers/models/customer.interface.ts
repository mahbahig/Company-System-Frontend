import type { UserRef } from '../../../core/auth/models/user-ref.interface';

/** A customer account (backend `customers`), as list and detail endpoints return it. */
export interface Customer {
  id: string;
  customerNo: string;
  kind: 'company' | 'individual';
  nameAr?: string;
  nameEn?: string;
  primaryContactName?: string;
  categoryCode?: string;
  sectorCode?: string;
  statusCode: string;
  customerTypeCode?: string;
  governorateCode?: string;
  cityCode?: string;
  addressLine?: string;
  latitude?: number;
  longitude?: number;
  mobile?: string;
  landline?: string;
  whatsappNumber?: string;
  email?: string;
  website?: string;
  taxRegistrationNo?: string;
  commercialRegistrationNo?: string;
  leadSourceCode?: string;
  notes?: string;
  /** Populated on list/detail; a bare id elsewhere. */
  ownerId: UserRef | string | null;
  teamId?: string | null;
  openOpportunityCount: number;
  completenessScore?: number;
  lastActivityAt?: string | null;
  nextFollowUpAt?: string | null;
  enrichmentDueAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

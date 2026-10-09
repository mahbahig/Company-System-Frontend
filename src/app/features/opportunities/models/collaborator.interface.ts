import type { UserRef } from '../../../core/auth/models/user-ref.interface';

/** OPP-10..13: an invited contributor. Collaboration never changes ownership. */
export interface Collaborator {
  userId: UserRef | string;
  role: 'project_manager' | 'technical_lead' | 'engineer' | 'finance' | 'sales' | 'other';
  isTechnicalPoc: boolean;
  addedAt: string;
}

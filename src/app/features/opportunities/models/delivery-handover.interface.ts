import type { RequirementResult } from '../../../shared/crm/pipeline-tracker/workflow-view.interface';

/** The Sales → Delivery handover case (H0 → H1). */
export interface DeliveryHandover {
  id: string;
  handoverNo: string;
  status: 'draft' | 'submitted' | 'returned' | 'accepted' | 'withdrawn';
  fromUserId: string;
  toUserId?: string | null;
  pack: Record<string, unknown>;
  confirmations: Array<{ kind: string; by: string; at: string; note?: string }>;
  returnReason?: string | null;
  returnItems: string[];
  slaDueAt?: string | null;
  projectId?: string | null;
  events: Array<{ type: string; at: string; by?: string | null; note?: string }>;
}

export interface DeliveryHandoverView {
  handover: DeliveryHandover | null;
  requirements: RequirementResult[];
  ready: boolean;
  permissions: {
    canEditPack: boolean;
    canSubmit: boolean;
    canConfirmDesign: boolean;
    canConfirmFinance: boolean;
    canVerifyWon: boolean;
    canDecide: boolean;
  };
}

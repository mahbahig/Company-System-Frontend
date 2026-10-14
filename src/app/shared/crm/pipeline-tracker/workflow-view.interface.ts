/** One condition a transition needs, evaluated by the backend against the live record. */
export interface RequirementResult {
  /** i18n key suffix `pipeline.requirements.<code>`. */
  code: string;
  kind: 'field' | 'evidence' | 'approval' | 'blocker' | 'ownership' | 'version' | 'gate' | 'role';
  met: boolean;
  /** Values for the message (missing item ids, versions, counts …). */
  params?: Record<string, unknown>;
}

/** Whether one transition can happen now, and exactly why not. */
export interface TransitionReport {
  pipeline: string;
  action: string;
  from: string;
  to: string;
  /** The current user may perform it (role, permission and record scope). */
  permitted: boolean;
  /** Every requirement is met. */
  ready: boolean;
  requirements: RequirementResult[];
  performedBy: string[];
  approvedBy: string[];
}

/** The questions every active record must answer (stage, owner, next action, due date, approvers). */
export interface OperationalControl {
  controlled: boolean;
  missing: string[];
  stage: string;
  stageEnteredAt: string | null;
  ownerId: string | null;
  nextAction: string | null;
  nextActionOwnerId: string | null;
  dueAt: string | null;
  escalation: string;
  nextApprovers: string[];
}

/** One stage-history entry (never rewritten). */
export interface StageEntry {
  fromStage: string | null;
  toStage: string;
  enteredAt: string;
  exitedAt?: string | null;
  changedBy?: string | { id: string; fullNameAr?: string; fullNameEn?: string } | null;
  action?: string;
  reason?: string;
  evidence?: Array<{ kind: string; refId?: string | null; label?: string; version?: number | null }>;
  approvalIds?: string[];
}

/** A blocker with its accountable owner and due date. */
export interface WorkflowBlocker {
  id?: string;
  _id?: string;
  code: string;
  description: string;
  severity: 'blocking' | 'critical' | 'warning';
  ownerId: string;
  dueAt: string;
  createdAt?: string;
  resolvedAt?: string | null;
  resolution?: string;
}

/** Live workflow state of one record (`GET /<records>/:id/workflow`). */
export interface WorkflowView {
  pipeline: string;
  stage: string;
  history: StageEntry[];
  blockers: WorkflowBlocker[];
  control: OperationalControl;
  transitions: TransitionReport[];
}

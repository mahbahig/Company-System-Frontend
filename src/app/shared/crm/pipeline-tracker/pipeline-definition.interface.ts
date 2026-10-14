/** One stage of a controlled pipeline (`GET /pipelines`). */
export interface StageDefinition {
  code: string;
  /** Business label from the specification: `L0`, `O3`, `D6`, `H1`, `P2` … */
  key: string;
  kind: 'open' | 'terminal' | 'exception';
  responsibleRoles: string[];
}

/** A permitted move between stages, performed by a business action. */
export interface TransitionDefinition {
  from: string[];
  to: string;
  action: string;
  kind: 'forward' | 'rework' | 'exception' | 'close' | 'reopen';
  performedBy: string[];
  approvedBy: string[];
  toPrevious?: boolean;
}

export interface PipelineDefinition {
  code: string;
  entity: string;
  stageField: string;
  stages: StageDefinition[];
  transitions: TransitionDefinition[];
}

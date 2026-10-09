import type { GateCheck } from './gate-check.interface';

/** Result of evaluating every gate for a target stage (`GET /opportunities/:id/gates`). */
export interface GateEvaluation {
  toStage: string;
  checks: GateCheck[];
  /** Failed hard gates (need `gates.override` + reason). */
  blockingHard: GateCheck[];
  /** Failed soft gates (owner may override with a reason). */
  blockingSoft: GateCheck[];
  canProceed: boolean;
}

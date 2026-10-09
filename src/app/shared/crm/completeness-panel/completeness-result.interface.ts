import type { CompletenessItem } from './completeness-item.interface';

/** Completeness score and the items still missing (CPL-01..05). */
export interface CompletenessResult {
  entity: string;
  score: number;
  total: number;
  satisfiedCount: number;
  missing: CompletenessItem[];
}

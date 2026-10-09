import type { Opportunity } from './opportunity.interface';

/** One Kanban column (OPP-04) with totals — `GET /opportunities/board`. */
export interface BoardColumn {
  stage: string;
  count: number;
  totalValue: number;
  weightedValue: number;
  cards: Opportunity[];
}

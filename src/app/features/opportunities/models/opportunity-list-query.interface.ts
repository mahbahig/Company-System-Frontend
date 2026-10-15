/** Query for `GET /opportunities`. */
export interface OpportunityListQuery {
  q?: string;
  stage?: string;
  outcome?: string;
  solutionType?: string;
  priority?: string;
  health?: string;
  customerId?: string;
  ownerId?: string;
  mine?: boolean;
  /** "Collaborating on" (OPP-12). */
  collaborating?: boolean;
  /** No next action, or next action date in the past (OPP-06). */
  nextActionOverdue?: boolean;
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: 'asc' | 'desc';
  incomplete?: boolean;
  intakeIncomplete?: boolean;
  /** Exceptions Center: health at risk or critical / technical data missing after the handoff. */
  stagnant?: boolean;
  technicalGap?: boolean;
}

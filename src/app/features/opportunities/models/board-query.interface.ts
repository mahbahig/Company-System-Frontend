/** Query for `GET /opportunities/board`. */
export interface BoardQuery {
  q?: string;
  ownerId?: string;
  solutionType?: string;
  mine?: boolean;
}

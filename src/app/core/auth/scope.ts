/** Record-level reach of a permission: own records, team records, or all. */
export type Scope = 'own' | 'team' | 'all';

/** Order used to compare scopes (a wider scope satisfies a narrower one). */
export const SCOPE_RANK: Record<Scope, number> = { own: 1, team: 2, all: 3 };

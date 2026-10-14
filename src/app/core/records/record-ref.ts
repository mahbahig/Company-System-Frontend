import { FileSignature, FileText, FolderKanban, Target, UserRound, Users, type IconNode } from 'lucide';

/**
 * Records with their own page that can be bookmarked (favorites, recently
 * viewed). Mirrors the backend `RESOLVABLE_RECORD_TYPES`; contacts open
 * inside their customer, so they are searchable but not bookmarked.
 */
export const RECORD_TYPES = ['customer', 'lead', 'opportunity', 'proposal', 'contract', 'project'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

/** One record pointer — never a label: names are always read fresh, under the caller's current access. */
export interface RecordRef {
  type: RecordType;
  id: string;
}

/** A record (or search hit) the server confirmed the caller can open, with its fresh label. */
export interface RecordHit {
  type: RecordType | 'contact';
  id: string;
  number?: string;
  title: string;
  subtitle?: string;
  /** Path under `/:locale`, possibly with a query string (e.g. `?tab=contacts`). */
  route: string;
}

export const RECORD_ICONS: Record<RecordHit['type'], IconNode> = {
  customer: Users,
  contact: UserRound,
  lead: UserRound,
  opportunity: Target,
  proposal: FileText,
  contract: FileSignature,
  project: FolderKanban,
};

/** Display order of the grouped results (search page, command palette). */
export const RECORD_GROUP_ORDER: ReadonlyArray<RecordHit['type']> = ['customer', 'contact', 'lead', 'opportunity', 'proposal', 'contract', 'project'];

export const refKey = (ref: { type: string; id: string }) => `${ref.type}:${ref.id}`;

export function isRecordType(value: unknown): value is RecordType {
  return typeof value === 'string' && (RECORD_TYPES as readonly string[]).includes(value);
}

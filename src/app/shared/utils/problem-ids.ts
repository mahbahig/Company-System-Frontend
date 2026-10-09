/**
 * Ids of the fields a rejected request complained about: validation `fieldErrors` keys plus the
 * `details.missing` items of a gate error (e.g. `designFiles`, `design.capacityKwp`, `bom`).
 * Pages use them to mark the matching inputs red.
 */
export function problemIds(error: unknown): ReadonlySet<string> {
  if (!error || typeof error !== 'object') return new Set();
  const { fieldErrors, details } = error as { fieldErrors?: Record<string, string>; details?: { missing?: Array<{ id?: string; field?: string }> } };
  const ids = [...Object.keys(fieldErrors ?? {}), ...(details?.missing ?? []).flatMap((item) => [item.id, item.field])];
  return new Set(ids.filter((id): id is string => !!id));
}

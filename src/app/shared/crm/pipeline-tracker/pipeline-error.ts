import type { I18nService } from '../../../core/i18n/i18n.service';
import type { RequirementResult } from './workflow-view.interface';

/**
 * The server's refusal of a pipeline action as one readable sentence: the
 * error itself plus, for a blocked transition, every unmet requirement
 * ("Cannot move to …: survey report missing, Technical Lead review missing").
 */
export function pipelineErrorText(i18n: I18nService, error: unknown): string {
  const base = i18n.errorText(error);
  const details = (error as { details?: { unmet?: RequirementResult[] } } | null)?.details;
  const unmet = (details?.unmet ?? []).filter((item) => !item.met);
  if (!unmet.length) return base;
  const labels = unmet.map((item) => {
    const key = `pipeline.requirements.${item.code}`;
    return i18n.has(key) ? i18n.t(key, flat(item.params)) : item.code.replace(/_/g, ' ');
  });
  return `${base} ${labels.join(i18n.locale() === 'ar' ? '، ' : '; ')}`;
}

function flat(params?: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params ?? {})) if (typeof value === 'string' || typeof value === 'number') out[key] = value;
  return out;
}

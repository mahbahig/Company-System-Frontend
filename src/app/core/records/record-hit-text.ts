import type { I18nService } from '../i18n/i18n.service';
import type { ReferenceDataService } from '../reference/reference-data.service';
import type { RecordHit } from './record-ref';

/** Second line of a record hit: the stage / status in words, or the server's subtitle (company, phone, Arabic name). */
export function hitSubtitle(hit: RecordHit, i18n: I18nService, reference: ReferenceDataService): string {
  if (!hit.subtitle) return '';
  if (hit.type === 'opportunity') return reference.label('pipeline_stage', hit.subtitle);
  const enumName = hit.type === 'proposal' ? 'combinedProposalStatus' : hit.type === 'contract' ? 'contractStatus' : hit.type === 'project' ? 'projectStatus' : null;
  if (enumName) {
    const key = `enums.${enumName}.${hit.subtitle}`;
    return i18n.has(key) ? i18n.t(key) : hit.subtitle;
  }
  return hit.subtitle;
}

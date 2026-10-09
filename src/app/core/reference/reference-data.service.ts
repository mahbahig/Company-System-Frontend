import { Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { toneFromColor, type BadgeTone } from '../../shared/ui/badge/badge-variants';
import { ApiService } from '../api/api.service';
import { I18nService } from '../i18n/i18n.service';
import type { ReferenceItem } from './reference-item.interface';
import type { ReferenceType } from './reference-type';

const BADGE_TONES: readonly string[] = ['neutral', 'info', 'success', 'warning', 'danger', 'outline'];

/**
 * Cached lookups (governorates, statuses, stages, sources …) loaded once per
 * session from `GET /reference`. Every code shown in the UI goes through
 * `label()` — raw codes are never displayed (UI rule).
 */
@Service()
export class ReferenceDataService {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);

  private readonly groups = signal<Partial<Record<ReferenceType, ReferenceItem[]>>>({});
  private loading: Promise<void> | null = null;

  /** Loads every list once; safe to call from any page. */
  load(): Promise<void> {
    this.loading ??= firstValueFrom(this.api.get<Record<ReferenceType, ReferenceItem[]>>('reference'))
      .then((groups) => this.groups.set(groups))
      .catch((error: unknown) => {
        this.loading = null; // allow a retry on the next page
        throw error;
      });
    return this.loading;
  }

  /** Re-fetches every list (after master data was edited). */
  reload(): Promise<void> {
    this.loading = null;
    return this.load();
  }

  /** Every item of a list including inactive ones (admin screens). */
  all(type: ReferenceType): ReferenceItem[] {
    return this.groups()[type] ?? [];
  }

  /** Active items of a list, in display order. */
  items(type: ReferenceType): ReferenceItem[] {
    return (this.groups()[type] ?? []).filter((item) => item.isActive);
  }

  /** `{ value, label }` pairs for selects, in the active language. */
  options(type: ReferenceType): { value: string; label: string }[] {
    return this.items(type).map((item) => ({ value: item.code, label: this.i18n.pick(item.nameAr, item.nameEn) }));
  }

  find(type: ReferenceType, code: string | null | undefined): ReferenceItem | undefined {
    return code ? this.groups()[type]?.find((item) => item.code === code) : undefined;
  }

  /** Label for a code; falls back to "not set" rather than the raw code. */
  label(type: ReferenceType, code: string | null | undefined): string {
    const item = this.find(type, code);
    if (item) return this.i18n.pick(item.nameAr, item.nameEn);
    return code ? this.i18n.t('crm.common.unknownValue') : this.i18n.t('crm.common.notSet');
  }

  /** Badge tone from `meta.tone` (or a legacy `meta.color`). */
  tone(type: ReferenceType, code: string | null | undefined): BadgeTone {
    const meta = this.find(type, code)?.meta;
    const tone = typeof meta?.['tone'] === 'string' ? meta['tone'] : null;
    if (tone && BADGE_TONES.includes(tone)) return tone as BadgeTone;
    return toneFromColor(typeof meta?.['color'] === 'string' ? meta['color'] : null);
  }
}

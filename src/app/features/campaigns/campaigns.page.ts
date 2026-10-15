import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../core/reference/reference-data.service';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../shared/ui/table/table.imports';
import { ActionRunner } from '../../shared/utils/action-runner';
import { SkeletonRowComponent } from '../../shared/ui/skeleton/skeleton.component';

interface CampaignAd {
  code: string;
  name: string;
  platform?: string;
  spend?: number;
}

interface Campaign {
  code: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  channelCode?: string;
  startDate: string | null;
  endDate: string | null;
  budget: number;
  spend: number;
  targetSectorCodes: string[];
  targetGovernorateCodes: string[];
  ads: CampaignAd[];
  notes?: string;
}

interface Draft {
  code: string;
  nameAr: string;
  nameEn: string;
  channelCode: string;
  startDate: string;
  endDate: string;
  budget: string;
  spend: string;
  targetSectorCodes: string[];
  targetGovernorateCodes: string[];
  ads: CampaignAd[];
  notes: string;
  isActive: boolean;
}

/**
 * MKT-01/02 campaigns: master data (channel, dates, budget and spend, target
 * sectors / areas, ads) feeding first-touch attribution and the campaign
 * performance report (MKT-04).
 */
@Component({
  selector: 'app-campaigns-page',
  imports: [SkeletonRowComponent, RouterLink, TranslatePipe, AlertComponent, ButtonDirective, DialogComponent, PageHeaderComponent, ...TABLE_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './campaigns.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class CampaignsPage {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  protected readonly data = rxResource({ stream: () => this.api.get<Campaign[]>('campaigns') });
  protected readonly rows = computed(() => this.data.value() ?? []);
  protected readonly canManage = computed(() => this.auth.can('campaigns.manage'));
  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<string | null>(null);
  protected readonly draft = signal<Draft>(this.blank());
  protected readonly valid = computed(() => {
    const d = this.draft();
    return /^[a-z0-9][a-z0-9_-]{0,60}$/.test(d.code) && !!d.nameAr.trim() && !!d.nameEn.trim() && !!d.channelCode && !!d.startDate && d.ads.every((ad) => ad.code && ad.name);
  });

  constructor() {
    void this.reference.load();
  }

  private blank(): Draft {
    return { code: '', nameAr: '', nameEn: '', channelCode: '', startDate: '', endDate: '', budget: '', spend: '', targetSectorCodes: [], targetGovernorateCodes: [], ads: [], notes: '', isActive: true };
  }

  protected edit(row: Campaign | null): void {
    this.actions.error.set(null);
    this.editing.set(row?.code ?? null);
    this.draft.set(
      row
        ? {
            code: row.code,
            nameAr: row.nameAr,
            nameEn: row.nameEn,
            channelCode: row.channelCode ?? '',
            startDate: row.startDate?.slice(0, 10) ?? '',
            endDate: row.endDate?.slice(0, 10) ?? '',
            budget: row.budget ? String(row.budget) : '',
            spend: row.spend ? String(row.spend) : '',
            targetSectorCodes: [...row.targetSectorCodes],
            targetGovernorateCodes: [...row.targetGovernorateCodes],
            ads: row.ads.map((ad) => ({ ...ad })),
            notes: row.notes ?? '',
            isActive: row.isActive,
          }
        : this.blank(),
    );
    this.dialogOpen.set(true);
  }

  protected set(key: keyof Draft, value: string): void {
    this.draft.update((d) => ({ ...d, [key]: key === 'code' ? value.trim().toLowerCase() : value }));
  }

  protected setActive(value: boolean): void {
    this.draft.update((d) => ({ ...d, isActive: value }));
  }

  protected setMulti(key: 'targetSectorCodes' | 'targetGovernorateCodes', event: Event): void {
    const values = Array.from((event.target as HTMLSelectElement).selectedOptions).map((option) => option.value);
    this.draft.update((d) => ({ ...d, [key]: values }));
  }

  protected addAd(): void {
    this.draft.update((d) => ({ ...d, ads: [...d.ads, { code: '', name: '' }] }));
  }

  protected setAd(index: number, key: keyof CampaignAd, value: string): void {
    this.draft.update((d) => ({ ...d, ads: d.ads.map((ad, i) => (i === index ? { ...ad, [key]: value || undefined } : ad)) as CampaignAd[] }));
  }

  protected removeAd(index: number): void {
    this.draft.update((d) => ({ ...d, ads: d.ads.filter((_, i) => i !== index) }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    const d = this.draft();
    const body = {
      nameAr: d.nameAr.trim(),
      nameEn: d.nameEn.trim(),
      channelCode: d.channelCode,
      startDate: d.startDate,
      endDate: d.endDate || (this.editing() ? null : undefined),
      budget: d.budget ? Number(d.budget) : undefined,
      spend: d.spend ? Number(d.spend) : undefined,
      targetSectorCodes: d.targetSectorCodes,
      targetGovernorateCodes: d.targetGovernorateCodes,
      ads: d.ads.map((ad) => ({ code: ad.code.trim().toLowerCase(), name: ad.name.trim(), platform: ad.platform || undefined, spend: ad.spend })),
      notes: d.notes || undefined,
      isActive: d.isActive,
    };
    const code = this.editing();
    const request: Observable<Campaign> = code ? this.api.patch(`campaigns/${code}`, body) : this.api.post('campaigns', { code: d.code, ...body });
    void this.actions.run(request, 'campaigns.saved', () => {
      this.dialogOpen.set(false);
      this.data.reload();
      void this.reference.reload();
    });
  }
}

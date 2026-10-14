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
  template: `
    <app-page-header [heading]="'campaigns.title' | t" [subtitle]="'campaigns.subtitle' | t" class="!mb-0">
      @if (auth.can('reports.view')) {
        <a appButton variant="outline" [routerLink]="['/', i18n.locale(), 'reports', 'campaign_performance']">{{ 'campaigns.performance' | t }}</a>
      }
      @if (canManage()) {
        <button type="button" appButton (click)="edit(null)">{{ 'campaigns.new' | t }}</button>
      }
    </app-page-header>
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    <app-table-wrapper [label]="'campaigns.title' | t" [attr.aria-busy]="data.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'campaigns.fields.name' | t }}</th>
            <th appTableHead>{{ 'campaigns.fields.channel' | t }}</th>
            <th appTableHead>{{ 'campaigns.fields.period' | t }}</th>
            <th appTableHead class="text-end">{{ 'campaigns.fields.budget' | t }}</th>
            <th appTableHead class="text-end">{{ 'campaigns.fields.spend' | t }}</th>
            <th appTableHead>{{ 'campaigns.fields.ads' | t }}</th>
            <th appTableHead>{{ 'campaigns.fields.status' | t }}</th>
            @if (canManage()) {
              <th appTableHead><span class="sr-only">{{ 'crm.common.edit' | t }}</span></th>
            }
          </tr>
        </thead>
        <tbody appTableBody>
          @for (row of rows(); track row.code) {
            <tr appTableRow>
              <td appTableCell>
                <span class="font-medium">{{ i18n.pick(row.nameAr, row.nameEn) }}</span>
                <span class="block text-xs text-muted-foreground" dir="ltr">{{ row.code }}</span>
              </td>
              <td appTableCell>{{ row.channelCode ? reference.label('lead_source', row.channelCode) : '—' }}</td>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(row.startDate) || '—' }} – {{ i18n.formatDate(row.endDate) || '…' }}</td>
              <td appTableCell class="tabular text-end">{{ i18n.formatMoney(row.budget) }}</td>
              <td appTableCell class="tabular text-end">{{ i18n.formatMoney(row.spend) }}</td>
              <td appTableCell class="tabular">{{ i18n.formatNumber(row.ads.length) }}</td>
              <td appTableCell>{{ (row.isActive ? 'campaigns.active' : 'campaigns.inactive') | t }}</td>
              @if (canManage()) {
                <td appTableCell><button type="button" appButton variant="ghost" size="sm" (click)="edit(row)">{{ 'crm.common.edit' | t }}</button></td>
              }
            </tr>
          } @empty {
            @if (data.isLoading()) {
              @for (i of [0, 1, 2, 3, 4]; track i) {
                <tr app-skeleton-row [columns]="8" [index]="i"></tr>
              }
            } @else {
              <tr app-table-empty [colSpan]="8">{{ 'campaigns.empty' | t }}</tr>
            }
          }
        </tbody>
      </table>
    </app-table-wrapper>

    <app-dialog [(open)]="dialogOpen" [heading]="(editing() ? 'campaigns.edit' : 'campaigns.new') | t">
      <form class="grid gap-4 sm:grid-cols-2" (submit)="save($event)">
        @if (actions.error(); as text) {
          <app-alert variant="destructive" class="sm:col-span-2">{{ text }}</app-alert>
        }
        <div>
          <label appLabel for="cmp-code" required>{{ 'campaigns.fields.code' | t }}</label>
          <input appInput id="cmp-code" dir="ltr" [disabled]="!!editing()" [value]="draft().code" (input)="set('code', $any($event.target).value)" />
          <p class="mt-1 text-xs text-muted-foreground">{{ 'campaigns.codeHint' | t }}</p>
        </div>
        <div>
          <label appLabel for="cmp-channel" required>{{ 'campaigns.fields.channel' | t }}</label>
          <app-select>
            <select appSelect id="cmp-channel" [value]="draft().channelCode" (change)="set('channelCode', $any($event.target).value)">
              <option value="">—</option>
              @for (option of reference.options('lead_source'); track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </app-select>
        </div>
        <div>
          <label appLabel for="cmp-ar" required>{{ 'campaigns.fields.nameAr' | t }}</label>
          <input appInput id="cmp-ar" dir="rtl" [value]="draft().nameAr" (input)="set('nameAr', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="cmp-en" required>{{ 'campaigns.fields.nameEn' | t }}</label>
          <input appInput id="cmp-en" dir="ltr" [value]="draft().nameEn" (input)="set('nameEn', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="cmp-start" required>{{ 'campaigns.fields.startDate' | t }}</label>
          <input appInput id="cmp-start" type="date" dir="ltr" [value]="draft().startDate" (change)="set('startDate', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="cmp-end">{{ 'campaigns.fields.endDate' | t }}</label>
          <input appInput id="cmp-end" type="date" dir="ltr" [value]="draft().endDate" (change)="set('endDate', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="cmp-budget">{{ 'campaigns.fields.budget' | t }}</label>
          <input appInput id="cmp-budget" type="number" min="0" dir="ltr" [value]="draft().budget" (input)="set('budget', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="cmp-spend">{{ 'campaigns.fields.spend' | t }}</label>
          <input appInput id="cmp-spend" type="number" min="0" dir="ltr" [value]="draft().spend" (input)="set('spend', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="cmp-sectors">{{ 'campaigns.fields.sectors' | t }}</label>
          <select id="cmp-sectors" multiple class="h-28 w-full rounded-md border border-input bg-background p-1 text-sm" (change)="setMulti('targetSectorCodes', $event)">
            @for (option of reference.options('sector'); track option.value) {
              <option [value]="option.value" [selected]="draft().targetSectorCodes.includes(option.value)">{{ option.label }}</option>
            }
          </select>
        </div>
        <div>
          <label appLabel for="cmp-govs">{{ 'campaigns.fields.governorates' | t }}</label>
          <select id="cmp-govs" multiple class="h-28 w-full rounded-md border border-input bg-background p-1 text-sm" (change)="setMulti('targetGovernorateCodes', $event)">
            @for (option of reference.options('governorate'); track option.value) {
              <option [value]="option.value" [selected]="draft().targetGovernorateCodes.includes(option.value)">{{ option.label }}</option>
            }
          </select>
        </div>
        <fieldset class="flex flex-col gap-2 sm:col-span-2">
          <legend class="mb-1 text-sm font-medium">{{ 'campaigns.fields.ads' | t }}</legend>
          @for (ad of draft().ads; track $index; let index = $index) {
            <div class="grid gap-2 sm:grid-cols-5">
              <input appInput dir="ltr" [attr.aria-label]="'campaigns.fields.adCode' | t" [placeholder]="'campaigns.fields.adCode' | t" [value]="ad.code" (input)="setAd(index, 'code', $any($event.target).value)" />
              <input appInput class="sm:col-span-2" [attr.aria-label]="'campaigns.fields.adName' | t" [placeholder]="'campaigns.fields.adName' | t" [value]="ad.name" (input)="setAd(index, 'name', $any($event.target).value)" />
              <input appInput [attr.aria-label]="'campaigns.fields.platform' | t" [placeholder]="'campaigns.fields.platform' | t" [value]="ad.platform ?? ''" (input)="setAd(index, 'platform', $any($event.target).value)" />
              <button type="button" appButton variant="ghost" size="sm" (click)="removeAd(index)">{{ 'crm.common.delete' | t }}</button>
            </div>
          }
          <button type="button" appButton variant="outline" size="sm" class="self-start" (click)="addAd()">{{ 'campaigns.addAd' | t }}</button>
        </fieldset>
        <div class="sm:col-span-2">
          <label appLabel for="cmp-notes">{{ 'campaigns.fields.notes' | t }}</label>
          <textarea appTextarea id="cmp-notes" rows="2" [value]="draft().notes" (input)="set('notes', $any($event.target).value)"></textarea>
        </div>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="draft().isActive" (change)="setActive($any($event.target).checked)" /> {{ 'campaigns.active' | t }}</label>
        <div class="flex gap-2 sm:col-span-2">
          <button type="submit" appButton [disabled]="actions.busy() || !valid()">{{ 'crm.common.save' | t }}</button>
          <button type="button" appButton variant="outline" (click)="dialogOpen.set(false)">{{ 'crm.common.cancel' | t }}</button>
        </div>
      </form>
    </app-dialog>
  `,
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

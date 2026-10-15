import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ArrowDownLeft, ArrowUpRight, Clock, Phone, type IconNode } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { userName } from '../../../shared/utils/display-name';
import { formatPhone } from '../../../shared/utils/format';
import { ActivitiesApi, refId, refLabel, type Call } from '../activities-api.service';

/**
 * E11 one logged call: outcome and direction up front, the call's facts, the
 * records it belongs to (links only where this user can open them), and the
 * summary / follow-up — one card, grouped into clear sections.
 */
@Component({
  selector: 'app-call-detail-page',
  imports: [RouterLink, TranslatePipe, EnumLabelPipe, BreadcrumbsComponent, DetailItemComponent, AlertComponent, BadgeComponent, IconComponent, PageHeaderComponent, DetailSkeletonComponent, ...CARD_IMPORTS],
  templateUrl: './call-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class CallDetailPage {
  private readonly api = inject(ActivitiesApi);
  private readonly navigation = inject(NavigationService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly formatPhone = formatPhone;
  protected readonly refId = refId;
  protected readonly clockIcon = Clock;
  protected readonly phoneIcon = Phone;

  readonly id = input.required<string>();
  protected readonly data = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.call(params) });
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('navigation.items.calls'), path: '/calls' },
    { label: this.data.value() ? this.i18n.formatDate(this.data.value()!.occurredAt, true) : '' },
  ]);

  constructor() {
    void this.reference.load();
  }

  protected directionIcon(call: Call): IconNode {
    return call.direction === 'inbound' ? ArrowDownLeft : ArrowUpRight;
  }

  /** "12 min" (or "45 s") for the header badge; null when unknown. */
  protected duration(call: Call): string | null {
    if (!call.durationSeconds) return null;
    return call.durationSeconds < 60
      ? this.i18n.t('ux.calls.seconds', { count: call.durationSeconds })
      : this.i18n.t('ux.calls.minutes', { count: this.i18n.formatNumber(call.durationSeconds / 60, { maximumFractionDigits: 1 }) });
  }

  protected canOpen(path: string): boolean {
    return this.navigation.canOpen(path);
  }

  protected label(value: Parameters<typeof refLabel>[1]): string {
    return refLabel((ar, en) => this.i18n.pick(ar, en), value) || '—';
  }

  protected name(value: Parameters<typeof userName>[1]): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value);
  }
}

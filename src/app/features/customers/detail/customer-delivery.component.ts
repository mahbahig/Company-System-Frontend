import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import type { Customer360 } from '../models/customer-360.interface';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { LocalPager } from '../../../shared/crm/pagination/local-pager';
import { PagerComponent } from '../../../shared/crm/pagination/pager.component';
import { PagerSizeComponent } from '../../../shared/crm/pagination/page-size-select.component';

/** CUST-03 the customer's leads, customer-facing proposals, contracts and projects. */
@Component({
  selector: 'app-customer-delivery',
  imports: [DetailSkeletonComponent, RouterLink, TranslatePipe, StatusBadgeComponent, ...TABLE_IMPORTS, PagerComponent, PagerSizeComponent],
  templateUrl: './customer-delivery.component.html',
  host: { class: 'flex flex-col gap-6' },
})
export class CustomerDeliveryComponent {
  protected readonly i18n = inject(I18nService);
  readonly data = input<Customer360 | undefined>();
  /** The customer's leads, paged in memory (they arrive with the customer's 360 view). */
  protected readonly leadsPager = new LocalPager(() => this.data()?.leads);
  /** The customer's projects, paged in memory (they arrive with the customer's 360 view). */
  protected readonly projectsPager = new LocalPager(() => this.data()?.projects);
  /** The customer's contracts, paged in memory (they arrive with the customer's 360 view). */
  protected readonly contractsPager = new LocalPager(() => this.data()?.contracts);
  /** The customer's proposals, paged in memory (they arrive with the customer's 360 view). */
  protected readonly proposalsPager = new LocalPager(() => this.data()?.proposals);
}

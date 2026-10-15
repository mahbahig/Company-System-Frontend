import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import type { Customer360 } from '../models/customer-360.interface';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

/** CUST-03 the customer's leads, customer-facing proposals, contracts and projects. */
@Component({
  selector: 'app-customer-delivery',
  imports: [DetailSkeletonComponent, RouterLink, TranslatePipe, StatusBadgeComponent, ...TABLE_IMPORTS],
  templateUrl: './customer-delivery.component.html',
  host: { class: 'flex flex-col gap-6' },
})
export class CustomerDeliveryComponent {
  protected readonly i18n = inject(I18nService);
  readonly data = input<Customer360 | undefined>();
}

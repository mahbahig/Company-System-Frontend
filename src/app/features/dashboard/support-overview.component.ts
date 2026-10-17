import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Inbox, RefreshCw } from 'lucide';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { StatCardComponent } from '../../shared/ui/stat-card/stat-card.component';
import { AWAITING_DESK_STATUS, CRUCIAL_SUPPORT_SEVERITY } from '../support/shared/support-display';
import { SupportApi } from '../support/support-api.service';

/**
 * The support desk at a glance, on the administrator's dashboard: new tickets
 * (waiting for the desk) and the critical ones among them — both counted by
 * the API (`GET /support/tickets/stats`), each opening the desk's list with
 * the same filter, so the number and the list always agree.
 */
@Component({
  selector: 'app-support-overview',
  imports: [RouterLink, TranslatePipe, AlertComponent, ButtonDirective, IconComponent, StatCardComponent],
  templateUrl: './support-overview.component.html',
})
export class SupportOverviewComponent {
  private readonly api = inject(SupportApi);
  protected readonly i18n = inject(I18nService);

  protected readonly icons = { desk: Inbox, refresh: RefreshCw };
  protected readonly stats = rxResource({ stream: () => this.api.stats() });
  protected readonly newQuery = { status: AWAITING_DESK_STATUS };
  protected readonly criticalQuery = { status: AWAITING_DESK_STATUS, severity: CRUCIAL_SUPPORT_SEVERITY };

  protected deskLink(): string {
    return `/${this.i18n.locale()}/admin/support-tickets`;
  }
}

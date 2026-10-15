import { Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Sun } from 'lucide';

import { ApiService } from '../../core/api/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DecorComponent } from '../../shared/decor/decor.component';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { DetailSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';

interface SharedProposal {
  proposalNo: string;
  versionNo: number;
  title?: string;
  language: string;
  customer: string;
  kwp?: number;
  price?: number;
  priceWithVat?: number;
  validUntil?: string;
  expired: boolean;
}

/**
 * PROP-07 customer-facing proposal link (no sign-in): summary and the PDF.
 * Opening it is recorded and notifies the owner; the link expires and can be
 * revoked from the CRM.
 */
@Component({
  selector: 'app-public-proposal-page',
  imports: [DetailSkeletonComponent, TranslatePipe, AlertComponent, ButtonDirective, IconComponent, DecorComponent],
  templateUrl: './public-proposal.page.html',
  host: { class: 'relative isolate flex min-h-dvh items-center justify-center px-4 py-12' },
})
export class PublicProposalPage {
  private readonly api = inject(ApiService);
  protected readonly i18n = inject(I18nService);
  protected readonly sun = Sun;

  readonly token = input.required<string>();
  protected readonly data = rxResource({
    params: () => this.token(),
    stream: ({ params }) =>
      this.api.get<SharedProposal>(`public/proposals/${encodeURIComponent(params)}`),
  });
  protected readonly busy = signal(false);
  protected readonly error = signal(false);

  protected async download(): Promise<void> {
    this.busy.set(true);
    this.error.set(false);
    try {
      const signed = await firstValueFrom(
        this.api.get<{ documentId: string; expiresAt: number; signature: string }>(
          `public/proposals/${encodeURIComponent(this.token())}/download`,
        ),
      );
      window.location.assign(
        `${this.api.url(`documents/${signed.documentId}/raw`)}?expiresAt=${signed.expiresAt}&signature=${encodeURIComponent(signed.signature)}`,
      );
    } catch {
      this.error.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}

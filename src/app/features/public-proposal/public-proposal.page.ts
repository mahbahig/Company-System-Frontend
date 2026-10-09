import { Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Sun } from 'lucide';

import { ApiService } from '../../core/api/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { IconComponent } from '../../shared/ui/icon/icon.component';

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
  imports: [TranslatePipe, AlertComponent, ButtonDirective, IconComponent],
  template: `
    <main id="main-content" class="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-xl">
      <div class="mb-6 flex items-center gap-3">
        <span aria-hidden="true" class="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><app-icon [icon]="sun" svgClass="size-5" /></span>
        <span class="text-lg font-semibold">{{ 'app.companyName' | t }}</span>
      </div>
      @if (data.error()) {
        <app-alert variant="destructive">{{ 'publicProposal.unavailable' | t }}</app-alert>
      } @else if (data.value(); as p) {
        <h1 class="text-xl font-semibold">{{ p.title || ('publicProposal.title' | t) }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ p.customer }}</p>
        <dl class="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="text-muted-foreground">{{ 'publicProposal.number' | t }}</dt>
            <dd class="tabular font-medium" dir="ltr">{{ p.proposalNo }} v{{ p.versionNo }}</dd>
          </div>
          @if (p.kwp) {
            <div>
              <dt class="text-muted-foreground">{{ 'publicProposal.capacity' | t }}</dt>
              <dd class="tabular font-medium">{{ i18n.formatNumber(p.kwp) }} kWp</dd>
            </div>
          }
          @if (p.priceWithVat) {
            <div>
              <dt class="text-muted-foreground">{{ 'publicProposal.price' | t }}</dt>
              <dd class="tabular font-medium">{{ i18n.formatMoney(p.priceWithVat) }}</dd>
            </div>
          }
          <div>
            <dt class="text-muted-foreground">{{ 'publicProposal.validUntil' | t }}</dt>
            <dd class="tabular font-medium">{{ i18n.formatDate(p.validUntil) }}</dd>
          </div>
        </dl>
        @if (p.expired) {
          <app-alert variant="destructive" class="mt-6">{{ 'publicProposal.expired' | t }}</app-alert>
        }
        @if (error()) {
          <app-alert variant="destructive" class="mt-6">{{ 'publicProposal.downloadFailed' | t }}</app-alert>
        }
        <button type="button" appButton class="mt-6 w-full" [disabled]="busy()" (click)="download()">{{ 'publicProposal.download' | t }}</button>
      } @else {
        <p class="text-sm text-muted-foreground" role="status">{{ 'common.labels.loading' | t }}</p>
      }
    </main>
  `,
  host: { class: 'flex min-h-dvh items-center justify-center px-4 py-12' },
})
export class PublicProposalPage {
  private readonly api = inject(ApiService);
  protected readonly i18n = inject(I18nService);
  protected readonly sun = Sun;

  readonly token = input.required<string>();
  protected readonly data = rxResource({ params: () => this.token(), stream: ({ params }) => this.api.get<SharedProposal>(`public/proposals/${encodeURIComponent(params)}`) });
  protected readonly busy = signal(false);
  protected readonly error = signal(false);

  protected async download(): Promise<void> {
    this.busy.set(true);
    this.error.set(false);
    try {
      const signed = await firstValueFrom(this.api.get<{ documentId: string; expiresAt: number; signature: string }>(`public/proposals/${encodeURIComponent(this.token())}/download`));
      window.location.assign(`${this.api.url(`documents/${signed.documentId}/raw`)}?expiresAt=${signed.expiresAt}&signature=${encodeURIComponent(signed.signature)}`);
    } catch {
      this.error.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}

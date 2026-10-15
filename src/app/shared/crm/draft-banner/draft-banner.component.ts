import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { FilePen } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonDirective } from '../../ui/button/button.directive';
import { IconComponent } from '../../ui/icon/icon.component';

/**
 * Draft prompt for a long form: "Continue editing this draft?" with Restore /
 * Discard when an earlier draft exists; otherwise a quiet "Draft saved 10
 * seconds ago" status once this visit's input has been kept.
 */
@Component({
  selector: 'app-draft-banner',
  imports: [TranslatePipe, ButtonDirective, IconComponent],
  templateUrl: './draft-banner.component.html',
})
export class DraftBannerComponent {
  private readonly i18n = inject(I18nService);

  readonly offeredAt = input<number | null>(null);
  readonly savedAt = input<number | null>(null);
  readonly restore = output();
  readonly discard = output();

  protected readonly icon = FilePen;
  /** Re-renders the relative time every 15 s. */
  private readonly now = signal(Date.now());
  protected readonly relative = (at: number) => {
    const now = Math.max(this.now(), at);
    return now - at < 10_000 ? this.i18n.t('ux.drafts.justNow') : this.i18n.formatRelative(at, now);
  };

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 15_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}

import { Component, inject } from '@angular/core';
import { Info, TriangleAlert, X } from 'lucide';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonDirective } from '../button/button.directive';
import { IconComponent } from '../icon/icon.component';
import { ToastService, type ToastTone } from './toast.service';

/** Each tone's border, tint and icon colour — the alert palette, on a solid card so it reads over any page. */
const TONE: Record<ToastTone, { box: string; icon: string }> = {
  info: { box: 'border-info/40 bg-info/10', icon: 'text-info' },
  warning: { box: 'border-warning/40 bg-warning/10', icon: 'text-warning-tint' },
};

/** Where toasts appear (bottom corner, mirrored in Arabic), announced politely to screen readers. */
@Component({
  selector: 'app-toast-host',
  imports: [TranslatePipe, ButtonDirective, IconComponent],
  template: `
    <div class="pointer-events-none fixed bottom-4 end-4 z-[90] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" role="region" [attr.aria-label]="'toast.region' | t" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="pointer-events-auto overflow-hidden rounded-md bg-background shadow-lg animate-fade-in" role="status" data-testid="toast">
          <div class="flex items-start gap-3 rounded-md border p-4 text-sm" [class]="tone(toast.tone).box">
            <app-icon [icon]="toast.tone === 'warning' ? icons.warning : icons.info" svgClass="size-5" class="mt-0.5 shrink-0" [class]="tone(toast.tone).icon" aria-hidden="true" />
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <p class="font-semibold text-foreground" data-testid="toast-title">{{ toast.title }}</p>
              <p class="text-muted-foreground" data-testid="toast-message">{{ toast.message }}</p>
            </div>
            <button type="button" appButton variant="ghost" size="icon" class="-me-2 -mt-2 size-8 shrink-0" [attr.aria-label]="'toast.dismiss' | t" (click)="toasts.dismiss(toast.id)">
              <app-icon [icon]="icons.close" svgClass="size-4" />
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
  protected readonly icons = { info: Info, warning: TriangleAlert, close: X };
  protected readonly tone = (tone: ToastTone) => TONE[tone];
}

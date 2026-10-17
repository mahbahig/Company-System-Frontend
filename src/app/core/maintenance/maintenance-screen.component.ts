import { Component, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { RefreshCw, Wrench } from 'lucide';

import { TranslatePipe } from '../i18n/translate.pipe';
import { BrandMarkComponent } from '../../shared/ui/brand-mark/brand-mark.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { MaintenanceService } from './maintenance.service';

/**
 * The maintenance screen: covers the application while the API answers with
 * maintenance — a calm, branded message, no technical detail. It checks back
 * on its own (and on "Try again") and returns to the application when
 * maintenance is over.
 */
@Component({
  selector: 'app-maintenance-screen',
  imports: [TranslatePipe, BrandMarkComponent, ButtonDirective, IconComponent],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background px-4 py-10" role="alertdialog" aria-modal="true" aria-labelledby="maintenance-title" aria-describedby="maintenance-body" data-testid="maintenance-screen">
      <div class="flex w-full max-w-lg flex-col items-center gap-6 text-center">
        <app-brand-mark class="size-14" />
        <span class="flex size-12 items-center justify-center rounded-full bg-warning/15 text-warning-tint" aria-hidden="true">
          <app-icon [icon]="icons.maintenance" svgClass="size-6" />
        </span>
        <div class="flex flex-col gap-2">
          <h1 #heading id="maintenance-title" tabindex="-1" class="text-2xl font-semibold tracking-tight focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">{{ 'maintenance.title' | t }}</h1>
          <div id="maintenance-body" class="flex flex-col gap-1 text-muted-foreground">
            <p>{{ 'maintenance.back' | t }}</p>
            <p>{{ 'maintenance.later' | t }}</p>
          </div>
        </div>
        <button type="button" appButton variant="outline" [disabled]="maintenance.checking()" (click)="maintenance.checkNow()" data-testid="maintenance-retry">
          <app-icon [icon]="icons.retry" [class.animate-spin]="maintenance.checking()" />{{ 'maintenance.retry' | t }}
        </button>
        <p class="text-xs text-muted-foreground" role="status">{{ 'maintenance.auto' | t }}</p>
      </div>
    </div>
  `,
})
export class MaintenanceScreenComponent {
  protected readonly maintenance = inject(MaintenanceService);
  protected readonly icons = { maintenance: Wrench, retry: RefreshCw };
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  constructor() {
    // Screen readers and keyboards land on the message.
    afterNextRender(() => this.heading()?.nativeElement.focus());
  }
}

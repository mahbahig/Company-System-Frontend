import { A11yModule } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, type ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { Columns3 } from 'lucide';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonDirective } from '../../ui/button/button.directive';
import { IconComponent } from '../../ui/icon/icon.component';
import type { TableColumns } from './table-columns';

const POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
];

/**
 * "Columns" popover: real checkboxes for the columns this role may see (the
 * identifying column is fixed), staying open while several are toggled;
 * Escape or a click outside closes it and returns focus to the button.
 */
@Component({
  selector: 'app-column-picker',
  imports: [A11yModule, CdkConnectedOverlay, CdkOverlayOrigin, TranslatePipe, ButtonDirective, IconComponent],
  template: `
    <button
      #trigger
      type="button"
      appButton
      variant="outline"
      size="sm"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      (click)="open.set(!open())"
    >
      <app-icon [icon]="columnsIcon" />
      {{ 'ux.columns.button' | t }}
      @if (columns().customized()) {
        <span class="size-1.5 rounded-full bg-primary" aria-hidden="true"></span>
        <span class="sr-only">({{ 'ux.columns.customized' | t }})</span>
      }
    </button>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayHasBackdrop]="true"
      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
      (backdropClick)="close()"
      (detach)="close()"
      (overlayKeydown)="onKeydown($event)"
    >
      <div
        role="dialog"
        [attr.aria-label]="'ux.columns.heading' | t"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        class="app-popover z-50 w-60 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg"
      >
        <fieldset>
          <legend class="px-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ 'ux.columns.heading' | t }}</legend>
          <div class="flex max-h-72 flex-col overflow-y-auto scroll-area">
            @for (column of columns().allowed(); track column.id) {
              <label class="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-secondary has-[:disabled]:cursor-default has-[:disabled]:opacity-70">
                <input
                  type="checkbox"
                  class="size-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  [checked]="columns().show(column.id)"
                  [disabled]="!!column.locked"
                  (change)="columns().toggle(column.id)"
                />
                <span class="flex-1">{{ column.labelKey | t }}</span>
                @if (column.locked) {
                  <span class="text-2xs text-muted-foreground">{{ 'ux.columns.always' | t }}</span>
                }
              </label>
            }
          </div>
        </fieldset>
        <div class="mt-1 flex justify-between gap-2 border-t border-border pt-2">
          <button type="button" appButton variant="ghost" size="sm" [disabled]="!columns().customized()" (click)="columns().reset()">{{ 'ux.columns.reset' | t }}</button>
          <button type="button" appButton variant="outline" size="sm" (click)="close()">{{ 'ux.columns.done' | t }}</button>
        </div>
      </div>
    </ng-template>
  `,
})
export class ColumnPickerComponent {
  readonly columns = input.required<TableColumns>();

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  protected readonly columnsIcon = Columns3;
  protected readonly positions = POSITIONS;
  protected readonly open = signal(false);

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }
}

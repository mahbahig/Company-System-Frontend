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
  templateUrl: './column-picker.component.html',
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

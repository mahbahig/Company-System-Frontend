import { Pipe, inject, type PipeTransform } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { enumLabel } from './status-badge.component';

/** `{{ row.channel | enum: 'activityChannel' }}` — translated enum label (impure: follows the active language). */
@Pipe({ name: 'enum', pure: false })
export class EnumLabelPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: string | null | undefined, enumName: string): string {
    return enumLabel(this.i18n, enumName, value);
  }
}

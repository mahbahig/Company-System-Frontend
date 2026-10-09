import { Component, computed, inject, input } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { BadgeComponent } from '../../ui/badge/badge.component';
import type { BadgeTone } from '../../ui/badge/badge-variants';
import { statusTone } from './status-tone';

/**
 * A workflow status / enum value as a coloured badge:
 * `<app-status-badge enum="contractStatus" [value]="contract.status" />`.
 * The label comes from `enums.<enum>.<value>`; a raw code is never shown.
 */
@Component({
  selector: 'app-status-badge',
  imports: [BadgeComponent],
  template: `<app-badge [tone]="effectiveTone()">{{ label() }}</app-badge>`,
  host: { class: 'contents' },
})
export class StatusBadgeComponent {
  private readonly i18n = inject(I18nService);

  readonly enum = input.required<string>();
  readonly value = input<string | null | undefined>();
  /** Overrides the automatic tone. */
  readonly tone = input<BadgeTone>();

  protected readonly effectiveTone = computed(() => this.tone() ?? statusTone(this.value()));
  protected readonly label = computed(() => enumLabel(this.i18n, this.enum(), this.value()));
}

/** `enums.<enum>.<value>` with a safe fallback (never the raw code). */
export function enumLabel(i18n: I18nService, enumName: string, value: string | null | undefined): string {
  if (!value) return i18n.t('crm.common.notSet');
  const key = `enums.${enumName}.${value}`;
  return i18n.has(key) ? i18n.t(key) : i18n.t('crm.common.unknownValue');
}

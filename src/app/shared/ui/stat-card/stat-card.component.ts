import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * KPI tile: label, big value, optional hint (formula / "n of d") and an
 * optional link to the drill-down. Tone colours only the left accent so the
 * number stays readable in both themes.
 */
@Component({
  selector: 'app-stat-card',
  imports: [RouterLink],
  templateUrl: './stat-card.component.html',
  host: { class: 'block' },
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string>();
  readonly link = input<string | unknown[]>();
  readonly queryParams = input<Record<string, string>>();
  readonly tone = input<'neutral' | 'success' | 'warning' | 'danger' | 'info'>('neutral');

  protected accent(): string {
    const map = {
      neutral: '',
      success: 'border-s-4 border-s-success',
      warning: 'border-s-4 border-s-warning',
      danger: 'border-s-4 border-s-destructive',
      info: 'border-s-4 border-s-info',
    } as const;
    return map[this.tone()];
  }
}

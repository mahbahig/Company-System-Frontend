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
  template: `
    <div
      class="group/stat relative flex h-full flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-sm transition-[box-shadow,transform,translate,border-color] duration-500 ease-emphasized hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
      [class]="accent()"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ label() }}</p>
      @if (link()) {
        <a
          [routerLink]="link()"
          [queryParams]="queryParams()"
          class="tabular text-3xl font-semibold tracking-tight text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          dir="ltr"
          >{{ value() }}</a
        >
      } @else {
        <p class="tabular text-3xl font-semibold tracking-tight" dir="ltr">{{ value() }}</p>
      }
      @if (hint()) {
        <p class="text-xs text-muted-foreground">{{ hint() }}</p>
      }
    </div>
  `,
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

import { Component, computed, input, numberAttribute } from '@angular/core';

/**
 * Loading placeholders shaped like the content they stand in for, so a page
 * keeps its layout while data arrives. The shimmer is a single slow pulse
 * (frozen by the reduced-motion rule); the real content announces itself
 * through the container's `aria-busy`, so placeholders are hidden from AT.
 */
@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.component.html',
  host: { 'aria-hidden': 'true', class: 'block rounded-md bg-muted animate-skeleton' },
})
export class SkeletonComponent {}

/** `<tr app-table-skeleton [columns]="9" />` inside a `<tbody>` while a list loads. */
@Component({
  selector: 'tbody[app-table-skeleton]',
  imports: [SkeletonComponent],
  templateUrl: './table-skeleton.component.html',
  host: { 'aria-hidden': 'true' },
})
export class TableSkeletonComponent {
  readonly columns = input.required({ transform: numberAttribute });
  readonly rows = input(6, { transform: numberAttribute });

  protected readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, index) => index));
  protected readonly columnList = computed(() => Array.from({ length: this.columns() }, (_, index) => index));

  /** Deterministic, slightly ragged widths read as text rather than bars. */
  protected width(row: number, column: number): number {
    return 45 + ((row * 7 + column * 13) % 5) * 11;
  }
}

/** Detail-page placeholder: header block, a summary strip and two cards. */
@Component({
  selector: 'app-detail-skeleton',
  imports: [SkeletonComponent],
  templateUrl: './detail-skeleton.component.html',
  host: { role: 'status', class: 'flex flex-col gap-6', '[attr.aria-label]': 'label()' },
})
export class DetailSkeletonComponent {
  /** Announced once to screen readers ("Loading…"). */
  readonly label = input.required<string>();
  /** Summary tiles to sketch (0 for pages without a KPI strip). */
  readonly summary = input(0, { transform: numberAttribute });

  protected readonly tiles = computed(() => Array.from({ length: this.summary() }, (_, index) => index));
  protected readonly lines = [0, 1, 2, 3, 4, 5];
}

/** A list of stacked rows (timelines, panels, small lists). */
@Component({
  selector: 'app-list-skeleton',
  imports: [SkeletonComponent],
  templateUrl: './list-skeleton.component.html',
  host: { 'aria-hidden': 'true', class: 'flex flex-col gap-4' },
})
export class ListSkeletonComponent {
  readonly rows = input(4, { transform: numberAttribute });
  protected readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, index) => index));
}

/**
 * One placeholder table row, for a list's `@empty` branch while it loads:
 * `@for (i of [0, 1, 2, 3, 4]; track i) { <tr app-skeleton-row [columns]="6" [index]="i"></tr> }`.
 */
@Component({
  selector: 'tr[app-skeleton-row]',
  imports: [SkeletonComponent],
  templateUrl: './skeleton-row.component.html',
  host: { 'aria-hidden': 'true', class: 'border-b border-border last:border-0' },
})
export class SkeletonRowComponent {
  readonly columns = input.required({ transform: numberAttribute });
  readonly index = input(0, { transform: numberAttribute });
  protected readonly columnList = computed(() => Array.from({ length: Math.max(1, this.columns()) }, (_, index) => index));
}

/** Dashboard placeholder: a strip of KPI tiles above two chart panels. */
@Component({
  selector: 'app-dashboard-skeleton',
  imports: [SkeletonComponent],
  templateUrl: './dashboard-skeleton.component.html',
  host: { role: 'status', class: 'flex flex-col gap-6', '[attr.aria-label]': 'label()' },
})
export class DashboardSkeletonComponent {
  readonly label = input.required<string>();
}

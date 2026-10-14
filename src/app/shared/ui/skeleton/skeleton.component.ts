import { Component, computed, input, numberAttribute } from '@angular/core';

/**
 * Loading placeholders shaped like the content they stand in for, so a page
 * keeps its layout while data arrives. The shimmer is a single slow pulse
 * (frozen by the reduced-motion rule); the real content announces itself
 * through the container's `aria-busy`, so placeholders are hidden from AT.
 */
@Component({
  selector: 'app-skeleton',
  template: '',
  host: { 'aria-hidden': 'true', class: 'block rounded-md bg-muted animate-skeleton' },
})
export class SkeletonComponent {}

/** `<tr app-table-skeleton [columns]="9" />` inside a `<tbody>` while a list loads. */
@Component({
  selector: 'tbody[app-table-skeleton]',
  imports: [SkeletonComponent],
  template: `
    @for (row of rowList(); track row) {
      <tr class="border-b border-border last:border-0">
        @for (column of columnList(); track column) {
          <td class="px-3 py-3.5 align-middle">
            <app-skeleton class="h-3.5" [style.width.%]="width(row, column)" />
          </td>
        }
      </tr>
    }
  `,
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
  template: `
    <div class="flex flex-col gap-2">
      <app-skeleton class="h-3 w-24" />
      <app-skeleton class="h-7 w-72 max-w-full" />
      <app-skeleton class="h-4 w-48 max-w-full" />
    </div>
    <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      @for (tile of tiles(); track tile) {
        <app-skeleton class="h-20 rounded-lg" />
      }
    </div>
    <div class="grid gap-6 lg:grid-cols-3">
      <div class="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 lg:col-span-2">
        <app-skeleton class="h-5 w-40" />
        <div class="grid gap-4 sm:grid-cols-2">
          @for (line of lines; track line) {
            <div class="flex flex-col gap-2">
              <app-skeleton class="h-3 w-20" />
              <app-skeleton class="h-4 w-3/4" />
            </div>
          }
        </div>
      </div>
      <div class="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
        <app-skeleton class="h-5 w-32" />
        <app-skeleton class="h-4 w-full" />
        <app-skeleton class="h-4 w-5/6" />
        <app-skeleton class="h-4 w-2/3" />
      </div>
    </div>
  `,
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
  template: `
    @for (row of rowList(); track row) {
      <div class="flex items-start gap-3">
        <app-skeleton class="mt-1 size-2.5 shrink-0 rounded-full" />
        <div class="flex flex-1 flex-col gap-1.5">
          <app-skeleton class="h-4" [style.width.%]="60 + (row % 3) * 12" />
          <app-skeleton class="h-3 w-32" />
        </div>
      </div>
    }
  `,
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
  template: `
    @for (column of columnList(); track column) {
      <td class="px-3 py-3.5 align-middle">
        <app-skeleton class="h-3.5" [style.width.%]="45 + ((index() * 7 + column * 13) % 5) * 11" />
      </td>
    }
  `,
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
  template: `
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      @for (tile of [0, 1, 2, 3]; track tile) {
        <div class="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <app-skeleton class="h-3 w-24" />
          <app-skeleton class="h-7 w-20" />
        </div>
      }
    </div>
    <div class="grid gap-6 lg:grid-cols-2">
      @for (panel of [0, 1]; track panel) {
        <div class="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <app-skeleton class="h-5 w-40" />
          @for (bar of [0, 1, 2, 3]; track bar) {
            <app-skeleton class="h-3" [style.width.%]="90 - bar * 15" />
          }
        </div>
      }
    </div>
  `,
  host: { role: 'status', class: 'flex flex-col gap-6', '[attr.aria-label]': 'label()' },
})
export class DashboardSkeletonComponent {
  readonly label = input.required<string>();
}

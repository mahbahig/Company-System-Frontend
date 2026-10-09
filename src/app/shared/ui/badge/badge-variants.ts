import { cva, type VariantProps } from 'class-variance-authority';

/** Identical to the Next app's `badgeVariants`: a 15% wash with an AA-tested tint text. */
export const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-secondary text-secondary-foreground',
      info: 'bg-info/15 text-info-tint',
      success: 'bg-success/15 text-success-tint',
      warning: 'bg-warning/15 text-warning-tint',
      danger: 'bg-destructive/15 text-destructive-tint',
      outline: 'border border-border text-foreground',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

/** Maps a reference-data colour name onto a badge tone. */
export function toneFromColor(color: string | null | undefined): BadgeTone {
  switch ((color ?? '').toLowerCase()) {
    case 'green':
    case 'emerald':
    case 'teal':
      return 'success';
    case 'amber':
    case 'yellow':
    case 'orange':
      return 'warning';
    case 'red':
    case 'rose':
      return 'danger';
    case 'blue':
    case 'sky':
    case 'indigo':
    case 'violet':
      return 'info';
    default:
      return 'neutral';
  }
}

import { cva, type VariantProps } from 'class-variance-authority';

/** Identical to the Next app's `alertVariants`. */
export const alertVariants = cva('relative block w-full rounded-md border p-4 text-sm [&_svg]:size-4 [&_svg]:shrink-0', {
  variants: {
    variant: {
      default: 'border-border bg-secondary text-secondary-foreground',
      destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
      success: 'border-success/40 bg-success/10 text-success',
      warning: 'border-warning/40 bg-warning/10 text-warning',
      info: 'border-info/40 bg-info/10 text-info',
    },
  },
  defaultVariants: { variant: 'default' },
});

export type AlertVariant = NonNullable<VariantProps<typeof alertVariants>['variant']>;

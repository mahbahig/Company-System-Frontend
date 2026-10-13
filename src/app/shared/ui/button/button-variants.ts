import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../utils/cn';

/** Identical to the Next app's `buttonVariants` (components/ui/button.tsx). */
export const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md select-none',
    // One shared transition (colour, border, shadow, transform) on the brand
    // easing so every button settles with the same premium motion.
    'text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform,translate] duration-200 ease-premium',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-60',
    'aria-disabled:pointer-events-none aria-disabled:opacity-60',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ),
  {
    variants: {
      variant: {
        // Solid variants gain a faint lift + elevation on hover and press
        // back down on click — a small, expensive-feeling tactile cue.
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm',
        outline:
          'border border-input bg-background shadow-xs hover:border-primary/40 hover:bg-secondary hover:text-secondary-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-secondary hover:text-secondary-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3 text-sm',
        lg: 'h-11 px-6',
        icon: 'h-10 w-10',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: { variant: 'default', size: 'default', fullWidth: false },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

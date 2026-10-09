import type { ConnectedPosition } from '@angular/cdk/overlay';

/**
 * Drop-down placed under its trigger, aligned to the trigger's END edge
 * (Radix `align="end"`); `start`/`end` follow the text direction.
 */
export const END_ALIGNED_BELOW: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
];

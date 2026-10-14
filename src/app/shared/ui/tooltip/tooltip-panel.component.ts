import { Component, signal } from '@angular/core';

/**
 * The floating bubble rendered by `appTooltip`. Inverted colours (foreground
 * on background) read as a tooltip in both themes; it never takes pointer
 * events, so it cannot hide the control it describes.
 */
@Component({
  selector: 'app-tooltip-panel',
  template: `
    @if (heading()) {
      <span class="block font-semibold">{{ heading() }}</span>
    }
    @if (text()) {
      <span class="block" [class.font-normal]="heading()" [class.opacity-80]="heading()">{{ text() }}</span>
    }
  `,
  host: {
    'aria-hidden': 'true',
    class:
      'pointer-events-none block max-w-72 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium leading-snug text-background shadow-md animate-tooltip-in',
  },
})
export class TooltipPanelComponent {
  readonly heading = signal('');
  readonly text = signal('');
}

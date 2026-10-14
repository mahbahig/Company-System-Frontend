import { Service, signal } from '@angular/core';

/** Open state of the command palette (Ctrl/⌘+K, `/`, the top-bar search button). */
@Service()
export class CommandPalette {
  readonly open = signal(false);

  show(): void {
    this.open.set(true);
  }

  hide(): void {
    this.open.set(false);
  }

  toggle(): void {
    this.open.update((open) => !open);
  }
}

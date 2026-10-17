import { Component, computed, effect, inject, input, signal, untracked, type Signal } from '@angular/core';

import { AvatarStore } from '../../../core/users/avatar-store.service';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, string> = {
  xs: 'size-6 text-[0.625rem]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-xl',
  xl: 'size-24 text-3xl',
};

/**
 * An employee's profile picture, or the initial of their name when they have
 * none (or while it loads). Decorative by default — the name is beside it —
 * unless `label` is given.
 */
@Component({
  selector: 'app-avatar',
  template: `
    <span
      class="relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary font-semibold text-primary-foreground"
      [class]="sizeClass()"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'"
    >
      @if (image(); as src) {
        <img [src]="src" alt="" class="size-full object-cover" draggable="false" />
      } @else {
        {{ initial() }}
      }
    </span>
  `,
  host: { class: 'inline-flex' },
})
export class AvatarComponent {
  private readonly store = inject(AvatarStore);

  readonly userId = input<string | null | undefined>(null);
  readonly name = input('');
  /** The user's `avatarVersion`: null = no picture, undefined = not known (it is asked for). */
  readonly version = input<string | null | undefined>(undefined);
  readonly size = input<AvatarSize>('sm');
  /** Accessible name when the avatar stands alone (otherwise it is hidden from assistive technology). */
  readonly label = input<string | null>(null);
  /** A local picture to show instead (a preview before uploading). */
  readonly preview = input<string | null>(null);

  private readonly picture = signal<Signal<string | null> | null>(null);
  protected readonly image = computed(() => this.preview() ?? this.picture()?.() ?? null);
  protected readonly initial = computed(() => Array.from(this.name().trim())[0]?.toUpperCase() ?? '?');
  protected readonly sizeClass = computed(() => SIZES[this.size()]);

  constructor() {
    effect(() => {
      const userId = this.userId();
      const version = this.version();
      untracked(() => this.picture.set(userId ? this.store.url(userId, version) : null));
    });
  }
}

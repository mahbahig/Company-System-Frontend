import { Component, booleanAttribute, input } from '@angular/core';
import { CircleAlert, type IconNode } from 'lucide';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/**
 * Label, leading icon and message slots around a projected `appAuthInput`
 * (plus an optional trailing control such as a password toggle). The input
 * keeps its own bindings; point its `aria-describedby` at `<fieldId>-error`
 * or `<fieldId>-hint`, the ids this component renders. Keys, not text, go in.
 */
@Component({
  selector: 'app-auth-field',
  imports: [LabelComponent, IconComponent, TranslatePipe],
  template: `
    <label appLabel [for]="fieldId()" [required]="required()">{{ label() | t }}</label>
    <div class="group relative mt-2">
      @if (icon(); as icon) {
        <span
          aria-hidden="true"
          class="pointer-events-none absolute start-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground transition-colors duration-200 group-focus-within:text-primary"
        >
          <app-icon [icon]="icon" svgClass="size-[1.05rem]" />
        </span>
      }
      <ng-content />
    </div>
    @if (error(); as error) {
      <p
        [id]="fieldId() + '-error'"
        class="mt-2 flex items-start gap-1.5 text-[0.8125rem] leading-snug text-destructive-tint animate-fade-in-up"
      >
        <app-icon [icon]="errorIcon" svgClass="mt-px size-3.5 shrink-0" />{{ error | t }}
      </p>
    } @else if (hint()) {
      <p [id]="fieldId() + '-hint'" class="mt-2 text-xs leading-relaxed text-muted-foreground">
        {{ hint() | t }}
      </p>
    }
  `,
  host: { class: 'block' },
})
export class AuthFieldComponent {
  /** The projected input's `id`; also prefixes the message ids. */
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly icon = input<IconNode>();
  readonly error = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly required = input(false, { transform: booleanAttribute });

  protected readonly errorIcon = CircleAlert;
}

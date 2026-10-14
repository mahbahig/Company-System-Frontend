import { Component, ElementRef, booleanAttribute, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Check, Pencil, X } from 'lucide';
import { firstValueFrom, type Observable } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TIME_ZONE } from '../../../core/i18n/locale';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconComponent } from '../../ui/icon/icon.component';
import { TooltipDirective } from '../../ui/tooltip/tooltip.directive';

export type InlineEditType = 'text' | 'email' | 'tel' | 'date';

/**
 * Edit one simple field in place (`dd` of a detail list):
 * `<app-inline-edit [label]="…" [value]="lead.email" type="email" [editable]="detail.canEdit" [save]="saveEmail" />`.
 *
 * `editable` must come from the server's own verdict for this record (e.g.
 * `canEdit` on the detail response: permission, record scope, workflow stage)
 * — when false the field is plain text with no edit affordance. Saving calls
 * the page's normal update request, so the API's authorization and
 * validation decide; its error is shown under the field and the typed value
 * is kept for correction. Enter saves, Escape cancels.
 */
@Component({
  selector: 'app-inline-edit',
  imports: [IconComponent, TooltipDirective, TranslatePipe],
  template: `
    @if (editing()) {
      <form class="flex flex-col gap-1" novalidate (submit)="commit($event)" (keydown.escape)="cancel($event)">
        <div class="flex items-center gap-1.5">
          <input
            #field
            class="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
            [type]="type()"
            [attr.dir]="ltr() ? 'ltr' : null"
            [attr.aria-label]="label()"
            [attr.aria-invalid]="error() ? true : null"
            [attr.aria-describedby]="error() ? errorId : null"
            [attr.maxlength]="type() === 'date' ? null : maxLength()"
            [placeholder]="placeholder()"
            [value]="draft()"
            [disabled]="busy()"
            (input)="draft.set($any($event.target).value)"
          />
          <button
            type="submit"
            class="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            [attr.aria-label]="(busy() ? 'crm.common.saving' : 'crm.common.save') | t"
            [appTooltip]="'crm.common.save' | t"
            [disabled]="busy()"
          >
            <app-icon [icon]="checkIcon" />
          </button>
          <button
            type="button"
            class="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            [attr.aria-label]="'crm.common.cancel' | t"
            [appTooltip]="'crm.common.cancel' | t"
            [disabled]="busy()"
            (click)="cancel()"
          >
            <app-icon [icon]="closeIcon" />
          </button>
        </div>
        @if (busy()) {
          <span class="text-xs text-muted-foreground" role="status">{{ 'crm.common.saving' | t }}</span>
        }
        @if (error(); as message) {
          <span [id]="errorId" class="text-xs text-destructive" role="alert">{{ message }}</span>
        }
      </form>
    } @else {
      <span class="group/inline inline-flex max-w-full items-center gap-1.5">
        <span class="min-w-0 break-words" [attr.dir]="ltr() && hasValue() ? 'ltr' : null" [class.text-muted-foreground]="!hasValue()">
          <ng-content />
          @if (!hasContent()) {
            {{ shown() }}
          }
        </span>
        @if (editable()) {
          <button
            #editButton
            type="button"
            class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-70 transition-[opacity,background-color,color] hover:bg-secondary hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/inline:opacity-100"
            [attr.aria-label]="'ux.inlineEdit.edit' | t: { field: label() }"
            [appTooltip]="'ux.inlineEdit.edit' | t: { field: label() }"
            (click)="start()"
          >
            <app-icon [icon]="pencilIcon" svgClass="size-3.5" />
          </button>
        }
        @if (savedFlash()) {
          <span class="inline-flex items-center text-success-tint animate-fade-in" role="status">
            <app-icon [icon]="checkIcon" svgClass="size-3.5" />
            <span class="sr-only">{{ 'ux.inlineEdit.saved' | t }}</span>
          </span>
        }
      </span>
    }
  `,
  host: { class: 'block min-w-0' },
})
export class InlineEditComponent {
  private static nextId = 0;
  private readonly i18n = inject(I18nService);

  /** Field name, for the accessible labels ("Edit e-mail"). */
  readonly label = input.required<string>();
  /** The raw value the input edits (ISO date for date fields). */
  readonly value = input<string | null | undefined>(null);
  /** Text shown when not editing (defaults to the value, or "Not set"). */
  readonly display = input<string>('');
  readonly type = input<InlineEditType>('text');
  /** Server verdict for this record; false = read-only text. */
  readonly editable = input(false, { transform: booleanAttribute });
  readonly placeholder = input('');
  readonly maxLength = input(500);
  /** Projected content replaces the display text (e.g. a mailto link). */
  readonly hasContent = input(false, { transform: booleanAttribute });
  /** Optional client check mirroring the API rule; returns an i18n key, or null when valid. */
  readonly validate = input<((value: string) => string | null) | null>(null);
  /** Performs the page's normal update request. */
  readonly save = input.required<(value: string) => Observable<unknown>>();
  readonly saved = output<unknown>();

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private readonly editButton = viewChild<ElementRef<HTMLButtonElement>>('editButton');
  protected readonly pencilIcon = Pencil;
  protected readonly checkIcon = Check;
  protected readonly closeIcon = X;
  protected readonly errorId = `inline-edit-error-${InlineEditComponent.nextId++}`;

  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly draft = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly savedFlash = signal(false);

  protected readonly ltr = computed(() => ['email', 'tel', 'date'].includes(this.type()));
  protected readonly hasValue = computed(() => !!(this.display() || this.value()));
  protected readonly shown = computed(() => this.display() || this.value() || this.i18n.t('crm.common.notSet'));

  protected start(): void {
    this.draft.set(this.inputValue(this.value()));
    this.error.set(null);
    this.editing.set(true);
    queueMicrotask(() => this.field()?.nativeElement.focus());
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    if (this.busy()) return;
    this.editing.set(false);
    this.error.set(null);
    queueMicrotask(() => this.editButton()?.nativeElement.focus());
  }

  protected async commit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    const value = this.draft().trim();
    if (value === this.inputValue(this.value())) {
      this.cancel();
      return;
    }
    const invalid = this.validate()?.(value);
    if (invalid) {
      this.error.set(this.i18n.t(invalid));
      this.field()?.nativeElement.focus();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(this.save()(value));
      this.editing.set(false);
      this.saved.emit(result);
      this.savedFlash.set(true);
      setTimeout(() => this.savedFlash.set(false), 2000);
      queueMicrotask(() => this.editButton()?.nativeElement.focus());
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
      queueMicrotask(() => this.field()?.nativeElement.focus());
    } finally {
      this.busy.set(false);
    }
  }

  /** An ISO timestamp → the Cairo calendar day an `<input type=date>` expects. */
  private inputValue(value: string | null | undefined): string {
    if (!value) return '';
    if (this.type() !== 'date') return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
}

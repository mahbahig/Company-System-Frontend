import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Check, Search, X } from 'lucide';
import { debounceTime, distinctUntilChanged, of } from 'rxjs';

import { ChatApi } from '../../../core/chat/chat-api.service';
import type { ChatDirectoryPerson } from '../../../core/chat/chat.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/** Typing pauses this long before the directory is asked (no request per keystroke). */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Finds colleagues in the chat directory (names and job titles, from the
 * API) and picks one (`pick`) or several (`selected`, with chips). People
 * who may not join groups are shown but cannot be picked when
 * `groupsOnly` — the API refuses them anyway.
 */
@Component({
  selector: 'app-people-picker',
  imports: [TranslatePipe, AlertComponent, AvatarComponent, IconComponent, InputDirective],
  template: `
    @if (multiple() && selected().length) {
      <ul class="mb-3 flex flex-wrap gap-2" [attr.aria-label]="'chat.selectedPeople' | t">
        @for (person of selected(); track person.id) {
          <li class="inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pe-1 ps-1 text-sm">
            <app-avatar [userId]="person.id" [name]="name(person)" [version]="person.avatarVersion" size="xs" />
            <span class="max-w-40 truncate">{{ name(person) }}</span>
            <button type="button" class="rounded-full p-0.5 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [attr.aria-label]="'chat.removePerson' | t: { name: name(person) }" (click)="toggle(person)">
              <app-icon [icon]="icons.remove" svgClass="size-3.5" />
            </button>
          </li>
        }
      </ul>
    }
    <label class="relative block">
      <span class="sr-only">{{ 'chat.searchPeople' | t }}</span>
      <span class="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted-foreground"><app-icon [icon]="icons.search" /></span>
      <input appInput type="search" class="ps-9" autocomplete="off" data-testid="people-search" [placeholder]="'chat.searchPeople' | t" [value]="query()" (input)="query.set($any($event.target).value)" />
    </label>
    @if (people.error()) {
      <app-alert variant="destructive" class="mt-3">{{ i18n.errorText(people.error()) }}</app-alert>
    }
    <ul class="mt-3 flex max-h-72 flex-col gap-0.5 overflow-y-auto" role="listbox" [attr.aria-multiselectable]="multiple()" [attr.aria-busy]="people.isLoading()">
      @for (person of candidates(); track person.id) {
        <li>
          <button
            type="button"
            role="option"
            class="flex w-full items-center gap-3 rounded-md p-2 text-start transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            [attr.aria-selected]="isSelected(person)"
            [disabled]="groupsOnly() && !person.groupEligible"
            [attr.data-person-id]="person.id"
            (click)="choose(person)"
          >
            <app-avatar [userId]="person.id" [name]="name(person)" [version]="person.avatarVersion" size="sm" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium">{{ name(person) }}</span>
              <span class="block truncate text-xs text-muted-foreground">
                @if (groupsOnly() && !person.groupEligible) {
                  {{ 'chat.notGroupEligible' | t }}
                } @else {
                  {{ i18n.pick(person.jobTitleAr, person.jobTitleEn) }}
                }
              </span>
            </span>
            @if (isSelected(person)) {
              <app-icon [icon]="icons.check" svgClass="size-4 text-primary" />
            }
          </button>
        </li>
      } @empty {
        @if (!people.isLoading()) {
          <li class="px-2 py-6 text-center text-sm text-muted-foreground">{{ 'chat.noPeopleFound' | t }}</li>
        }
      }
    </ul>
  `,
})
export class PeoplePickerComponent {
  private readonly api = inject(ChatApi);
  protected readonly i18n = inject(I18nService);

  readonly multiple = input(false);
  /** Only people who may be in group chats can be picked. */
  readonly groupsOnly = input(false);
  /** People not to offer (already members). */
  readonly exclude = input<readonly string[]>([]);
  readonly selected = model<ChatDirectoryPerson[]>([]);
  /** Single mode: the person picked. */
  readonly pick = output<ChatDirectoryPerson>();

  protected readonly icons = { search: Search, check: Check, remove: X };
  protected readonly query = signal('');
  private readonly debounced = toSignal(toObservable(this.query).pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged()), { initialValue: '' });
  protected readonly people = rxResource({
    params: () => ({ q: this.debounced().trim() }),
    stream: ({ params }) => (params.q.length === 1 ? of([] as ChatDirectoryPerson[]) : this.api.people(params.q)),
  });
  protected readonly candidates = computed(() => {
    const excluded = new Set(this.exclude());
    return (this.people.hasValue() ? this.people.value() : []).filter((person) => !excluded.has(person.id));
  });

  protected name(person: ChatDirectoryPerson): string {
    return this.i18n.pick(person.nameAr, person.nameEn);
  }

  protected isSelected(person: ChatDirectoryPerson): boolean {
    return this.selected().some((chosen) => chosen.id === person.id);
  }

  protected choose(person: ChatDirectoryPerson): void {
    if (this.multiple()) this.toggle(person);
    else this.pick.emit(person);
  }

  protected toggle(person: ChatDirectoryPerson): void {
    this.selected.update((chosen) => (chosen.some((item) => item.id === person.id) ? chosen.filter((item) => item.id !== person.id) : [...chosen, person]));
  }
}

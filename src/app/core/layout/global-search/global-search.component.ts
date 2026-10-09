import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Search } from 'lucide';

import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

/**
 * Top-bar global search. `Ctrl`/`⌘`+`K` focuses it from anywhere; Enter opens
 * `/search?q=…` (phone numbers are normalised by the API before matching).
 */
@Component({
  selector: 'app-global-search',
  imports: [RouterLink, TranslatePipe, IconComponent],
  template: `
    <form role="search" class="relative hidden md:block" (submit)="submit($event)">
      <label for="global-search" class="sr-only">{{ 'search.placeholder' | t }}</label>
      <button type="submit" class="absolute inset-y-0 start-1 my-auto flex size-7 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [attr.aria-label]="'common.actions.search' | t"><app-icon [icon]="searchIcon" /></button>
      <input
        #input
        id="global-search"
        type="search"
        autocomplete="off"
        class="h-9 w-64 rounded-md border border-input bg-background ltr:pl-9 ltr:pr-14 rtl:pr-9 rtl:pl-14 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-80"
        [placeholder]="'search.placeholder' | t"
        [value]="text()"
        (input)="text.set($any($event.target).value)"
      />
      <kbd class="pointer-events-none absolute inset-y-0 end-2 my-auto hidden h-5 items-center rounded border border-border px-1.5 text-2xs text-muted-foreground lg:flex" dir="ltr">Ctrl K</kbd>
    </form>
    <a class="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden" [routerLink]="['/', i18n.locale(), 'search']" [attr.aria-label]="'search.title' | t">
      <app-icon [icon]="searchIcon" />
    </a>
  `,
  host: { class: 'contents', '(document:keydown)': 'onKey($event)' },
})
export class GlobalSearchComponent {
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');

  protected readonly searchIcon = Search;
  protected readonly text = signal('');

  protected onKey(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.input()?.nativeElement.focus();
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const q = this.text().trim();
    if (!q) {
      this.input()?.nativeElement.focus();
      return;
    }
    void this.router.navigate(['/', this.i18n.locale(), 'search'], { queryParams: { q } });
  }
}

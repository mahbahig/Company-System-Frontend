import { Component, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ApprovalsApi, type Delegation } from '../approvals-api.service';

/** USER-06: delegate my approvals to another authorised user for a date range (e.g. during leave). */
@Component({
  selector: 'app-approval-delegations-page',
  imports: [TranslatePipe, UserSelectComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-page-header [heading]="'approvals.delegations.title' | t" [subtitle]="'approvals.delegations.subtitle' | t" class="!mb-0" />
    <section appCard class="max-w-3xl">
      <form appCardContent class="flex flex-col gap-4" (submit)="save($event)">
        @if (error(); as message) {
          <app-alert variant="destructive">{{ message }}</app-alert>
        }
        @if (saved()) {
          <app-alert>{{ 'approvals.delegations.saved' | t }}</app-alert>
        }
        @for (row of rows(); track $index; let index = $index) {
          <div class="grid items-end gap-3 rounded-md border border-border p-3 sm:grid-cols-4">
            <div class="sm:col-span-2">
              <label appLabel [for]="'delegate-' + index">{{ 'approvals.delegations.delegate' | t }}</label>
              <app-user-select [inputId]="'delegate-' + index" [value]="row.delegateId" (valueChange)="update(index, 'delegateId', $event)" />
            </div>
            <div>
              <label appLabel [for]="'from-' + index">{{ 'approvals.delegations.from' | t }}</label>
              <input appInput type="date" dir="ltr" [id]="'from-' + index" [value]="row.from" (change)="update(index, 'from', $any($event.target).value)" />
            </div>
            <div>
              <label appLabel [for]="'to-' + index">{{ 'approvals.delegations.to' | t }}</label>
              <input appInput type="date" dir="ltr" [id]="'to-' + index" [value]="row.to" (change)="update(index, 'to', $any($event.target).value)" />
            </div>
            <div class="sm:col-span-4">
              <button type="button" appButton variant="ghost" size="sm" (click)="remove(index)">{{ 'crm.common.delete' | t }}</button>
            </div>
          </div>
        } @empty {
          <p class="text-sm text-muted-foreground">{{ 'approvals.delegations.none' | t }}</p>
        }
        <div class="flex gap-2">
          <button type="button" appButton variant="outline" (click)="add()">{{ 'approvals.delegations.add' | t }}</button>
          <button type="submit" appButton [disabled]="busy()">{{ 'crm.common.save' | t }}</button>
        </div>
      </form>
    </section>
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class ApprovalDelegationsPage {
  private readonly api = inject(ApprovalsApi);
  protected readonly i18n = inject(I18nService);

  protected readonly current = rxResource({ stream: () => this.api.delegations() });
  protected readonly rows = signal<Delegation[]>([]);
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const value = this.current.value();
      if (value) this.rows.set(value.delegations.map((row) => ({ delegateId: String(row.delegateId), from: String(row.from).slice(0, 10), to: String(row.to).slice(0, 10) })));
    });
  }

  protected add(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.rows.update((rows) => [...rows, { delegateId: '', from: today, to: today }]);
  }

  protected remove(index: number): void {
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected update(index: number, key: keyof Delegation, value: string): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.error.set(null);
    this.saved.set(false);
    try {
      const delegations = this.rows().filter((row) => row.delegateId);
      await firstValueFrom(this.api.setDelegations(delegations.map((row) => ({ ...row, to: `${row.to}T23:59:59` }))));
      this.saved.set(true);
      this.current.reload();
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
    } finally {
      this.busy.set(false);
    }
  }
}

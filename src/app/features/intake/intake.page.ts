import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../core/reference/reference-data.service';
import { CompletenessPanelComponent } from '../../shared/crm/completeness-panel/completeness-panel.component';
import { EnumLabelPipe } from '../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { IntakeApi, type IntakeFieldDef, type IntakeFieldValue } from './intake-api.service';
import { DetailSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';

interface Draft {
  value: unknown;
  origin: 'customer' | 'sales_observed';
}

/**
 * TIN-01..07 Technical Intake Form: sections and fields come from the
 * opportunity's solution type (admin-configurable), every value carries its
 * data origin, partial saves are allowed, and engineers verify fields without
 * losing the original value (shown in the history).
 */
@Component({
  selector: 'app-intake-page',
  imports: [DetailSkeletonComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, CompletenessPanelComponent, AlertComponent, BadgeComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  template: `
    @if (view.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(view.error()) }}</app-alert>
    }
    @if (view.value(); as v) {
      <app-page-header [heading]="'intake.title' | t" [subtitle]="reference.label('solution_type', v.solutionTypeCode)">
        <app-status-badge enum="intakeStatus" [value]="v.status" />
        <a appButton variant="outline" [routerLink]="['/', i18n.locale(), 'opportunities', id()]">{{ 'handoffs.backToOpportunity' | t }}</a>
      </app-page-header>

      @if (message(); as text) {
        <app-alert>{{ text }}</app-alert>
      }
      @if (error(); as text) {
        <app-alert variant="destructive">{{ text }}</app-alert>
      }

      <div class="grid gap-6 lg:grid-cols-3">
        <form class="flex flex-col gap-6 lg:col-span-2" (submit)="save($event)">
          @for (section of v.sectionsApplicable; track section) {
            <section appCard [attr.aria-labelledby]="'section-' + section">
              <div appCardHeader><h2 appCardTitle [id]="'section-' + section">{{ sectionLabel(section) }}</h2></div>
              <div appCardContent class="grid gap-5 sm:grid-cols-2">
                @for (field of fieldsOf(section); track field.id) {
                  @let key = section + '.' + field.id;
                  @let stored = v.sections[section]?.[field.id];
                  <div class="flex flex-col gap-1.5">
                    <label appLabel [for]="'f-' + key" [required]="field.required">{{ i18n.pick(field.labelAr, field.labelEn) }}</label>
                    @switch (field.type) {
                      @case ('boolean') {
                        <app-select>
                          <select appSelect [id]="'f-' + key" [disabled]="locked(key) || !canEdit()" [value]="text(key)" (change)="set(section, field, $any($event.target).value)">
                            <option value="">{{ 'crm.common.notSet' | t }}</option>
                            <option value="true" [selected]="text(key) === 'true'">{{ 'crm.common.yes' | t }}</option>
                            <option value="false" [selected]="text(key) === 'false'">{{ 'crm.common.no' | t }}</option>
                          </select>
                        </app-select>
                      }
                      @case ('select') {
                        <app-select>
                          <select appSelect [id]="'f-' + key" [disabled]="locked(key) || !canEdit()" [value]="text(key)" (change)="set(section, field, $any($event.target).value)">
                            <option value="">{{ 'crm.common.selectPlaceholder' | t }}</option>
                            @for (option of field.options ?? []; track option) {
                              <option [value]="option" [selected]="text(key) === option">{{ optionLabel(option) }}</option>
                            }
                          </select>
                        </app-select>
                      }
                      @case ('number') {
                        <input appInput type="number" step="any" dir="ltr" [id]="'f-' + key" [disabled]="locked(key) || !canEdit()" [value]="text(key)" (input)="set(section, field, $any($event.target).value)" />
                      }
                      @default {
                        <input appInput [id]="'f-' + key" [disabled]="locked(key) || !canEdit()" [value]="text(key)" (input)="set(section, field, $any($event.target).value)" />
                      }
                    }
                    <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      @if (stored) {
                        <app-badge [tone]="stored.origin === 'engineer_verified' ? 'success' : 'neutral'">{{ stored.origin | enum: 'dataOrigin' }}</app-badge>
                      }
                      @if (canEdit() && !locked(key)) {
                        <label class="flex items-center gap-1">
                          <span class="sr-only">{{ 'intake.origin' | t }}</span>
                          <select class="rounded border border-input bg-background px-1 py-0.5 text-xs" [value]="originOf(key)" (change)="setOrigin(section, field, $any($event.target).value)" [attr.aria-label]="'intake.origin' | t">
                            <option value="customer">{{ 'customer' | enum: 'dataOrigin' }}</option>
                            <option value="sales_observed">{{ 'sales_observed' | enum: 'dataOrigin' }}</option>
                          </select>
                        </label>
                      }
                      @if (stored && stored.history.length) {
                        <button type="button" class="text-primary underline-offset-4 hover:underline" (click)="toggleHistory(key)">{{ 'intake.history' | t: { count: stored.history.length } }}</button>
                      }
                      @if (canVerify() && stored) {
                        <button type="button" class="text-primary underline-offset-4 hover:underline" (click)="startVerify(section, field)">{{ 'intake.verify' | t }}</button>
                      }
                    </div>
                    @if (openHistory() === key && stored) {
                      <ul class="rounded-md bg-muted p-2 text-xs">
                        @for (entry of stored.history; track $index) {
                          <li>{{ display(entry.value) }} · {{ entry.origin | enum: 'dataOrigin' }} · <span class="tabular">{{ i18n.formatDate(entry.changedAt, true) }}</span>@if (entry.note) { — {{ entry.note }}}</li>
                        }
                      </ul>
                    }
                    @if (verifying() === key) {
                      <div class="flex flex-col gap-2 rounded-md border border-primary/40 p-3">
                        <label appLabel [for]="'verify-' + key">{{ 'intake.verifiedValue' | t }}</label>
                        <input appInput [id]="'verify-' + key" dir="auto" [value]="verifyValue()" (input)="verifyValue.set($any($event.target).value)" />
                        <label appLabel [for]="'verify-note-' + key">{{ 'intake.verifyNote' | t }}</label>
                        <input appInput [id]="'verify-note-' + key" [value]="verifyNote()" (input)="verifyNote.set($any($event.target).value)" />
                        <div class="flex gap-2">
                          <button type="button" appButton size="sm" [disabled]="busy()" (click)="verify(section, field)">{{ 'intake.confirmVerify' | t }}</button>
                          <button type="button" appButton size="sm" variant="ghost" (click)="verifying.set(null)">{{ 'crm.common.cancel' | t }}</button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </section>
          }
          @if (canEdit()) {
            <div class="sticky bottom-0 flex items-center gap-3 border-t border-border bg-background/95 py-3 backdrop-blur">
              <button type="submit" appButton [disabled]="busy() || !dirty()">{{ (busy() ? 'crm.common.saving' : 'intake.save') | t }}</button>
              <span class="text-sm text-muted-foreground" role="status">{{ dirty() ? ('intake.unsaved' | t: { count: dirtyCount() }) : ('intake.allSaved' | t) }}</span>
            </div>
          }
        </form>
        <div class="flex flex-col gap-6">
          <app-completeness-panel [result]="v.completeness" entityType="opportunity" [entityId]="id()" />
        </div>
      </div>
    } @else if (view.isLoading()) {
      <app-detail-skeleton [label]="'common.labels.loading' | t" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class IntakePage {
  private readonly api = inject(IntakeApi);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  /** Opportunity id. */
  readonly id = input.required<string>();

  protected readonly view = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get(params) });
  protected readonly drafts = signal<Record<string, Draft>>({});
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly openHistory = signal<string | null>(null);
  protected readonly verifying = signal<string | null>(null);
  protected readonly verifyValue = signal('');
  protected readonly verifyNote = signal('');

  protected readonly canEdit = computed(() => this.auth.can('intake.edit'));
  protected readonly canVerify = computed(() => this.auth.can('intake.verify'));
  protected readonly dirtyCount = computed(() => Object.keys(this.drafts()).length);
  protected readonly dirty = computed(() => this.dirtyCount() > 0);

  constructor() {
    void this.reference.load();
    effect(() => {
      if (this.view.value()) this.drafts.set({});
    });
  }

  protected fieldsOf(section: string): IntakeFieldDef[] {
    return (this.view.value()?.schema ?? []).filter((field) => field.section === section);
  }

  protected locked(key: string): boolean {
    return this.view.value()?.locked.includes(key) ?? false;
  }

  protected stored(key: string): IntakeFieldValue | undefined {
    const [section, field] = key.split('.');
    return this.view.value()?.sections[section]?.[field];
  }

  protected text(key: string): string {
    const draft = this.drafts()[key];
    const value = draft ? draft.value : this.stored(key)?.value;
    return value === null || value === undefined ? '' : String(value);
  }

  protected originOf(key: string): string {
    const draft = this.drafts()[key];
    const stored = this.stored(key)?.origin;
    return draft?.origin ?? (stored === 'sales_observed' ? 'sales_observed' : 'customer');
  }

  protected set(section: string, field: IntakeFieldDef, raw: string): void {
    const key = `${section}.${field.id}`;
    const value = raw === '' ? null : field.type === 'number' ? Number(raw) : field.type === 'boolean' ? raw === 'true' : raw;
    this.drafts.update((all) => ({ ...all, [key]: { value, origin: (all[key]?.origin ?? this.originOf(key)) as Draft['origin'] } }));
  }

  protected setOrigin(section: string, field: IntakeFieldDef, origin: Draft['origin']): void {
    const key = `${section}.${field.id}`;
    const current = this.drafts()[key];
    this.drafts.update((all) => ({ ...all, [key]: { value: current ? current.value : (this.stored(key)?.value ?? null), origin } }));
  }

  protected toggleHistory(key: string): void {
    this.openHistory.set(this.openHistory() === key ? null : key);
  }

  protected startVerify(section: string, field: IntakeFieldDef): void {
    const key = `${section}.${field.id}`;
    this.verifying.set(key);
    this.verifyValue.set(this.text(key));
    this.verifyNote.set('');
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const sections: Record<string, Record<string, { value: unknown; origin?: string }>> = {};
    for (const [key, draft] of Object.entries(this.drafts())) {
      const [section, field] = key.split('.');
      (sections[section] ??= {})[field] = { value: draft.value, origin: draft.origin };
    }
    await this.run(this.api.save(this.id(), sections), 'intake.saved');
  }

  protected async verify(section: string, field: IntakeFieldDef): Promise<void> {
    const raw = this.verifyValue();
    const value = raw === '' ? null : field.type === 'number' ? Number(raw) : field.type === 'boolean' ? raw === 'true' : raw;
    await this.run(this.api.verify(this.id(), { section, fieldId: field.id, value, note: this.verifyNote().trim() || undefined }), 'intake.verified');
    this.verifying.set(null);
  }

  protected sectionLabel(section: string): string {
    const key = `intake.sections.${section}`;
    return this.i18n.has(key) ? this.i18n.t(key) : section;
  }

  protected optionLabel(option: string): string {
    const key = `intake.options.${option}`;
    return this.i18n.has(key) ? this.i18n.t(key) : option;
  }

  protected display(value: unknown): string {
    if (value === true) return this.i18n.t('crm.common.yes');
    if (value === false) return this.i18n.t('crm.common.no');
    return value === null || value === undefined || value === '' ? '—' : this.optionLabel(String(value));
  }

  private async run(action: ReturnType<IntakeApi['save']>, successKey: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      await firstValueFrom(action);
      this.message.set(this.i18n.t(successKey));
      this.view.reload();
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
    } finally {
      this.busy.set(false);
    }
  }
}

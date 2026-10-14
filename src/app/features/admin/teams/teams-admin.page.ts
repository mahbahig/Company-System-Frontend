import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { userName } from '../../../shared/utils/display-name';
import { AdminApi, type Team } from '../admin-api.service';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';

const idOf = (value: string | { id: string } | null | undefined): string => (!value ? '' : typeof value === 'string' ? value : value.id);

/** USER-02 sales / delivery teams: manager, members and region (team scope for RBAC and dashboards). */
@Component({
  selector: 'app-teams-admin-page',
  imports: [SkeletonRowComponent, TranslatePipe, UserSelectComponent, AlertComponent, BadgeComponent, ButtonDirective, DialogComponent, PageHeaderComponent, ...TABLE_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-page-header [heading]="'admin.teams.title' | t" [subtitle]="'admin.teams.subtitle' | t" class="!mb-0">
      <button type="button" appButton (click)="edit(null)">{{ 'admin.teams.new' | t }}</button>
    </app-page-header>
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    <app-table-wrapper [label]="'admin.teams.title' | t" [attr.aria-busy]="data.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'admin.teams.team' | t }}</th>
            <th appTableHead>{{ 'admin.users.manager' | t }}</th>
            <th appTableHead>{{ 'admin.teams.members' | t }}</th>
            <th appTableHead>{{ 'admin.teams.region' | t }}</th>
            <th appTableHead>{{ 'admin.users.status' | t }}</th>
            <th appTableHead><span class="sr-only">{{ 'admin.actions' | t }}</span></th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (team of data.value() ?? []; track team.id) {
            <tr appTableRow>
              <td appTableCell>
                <span class="font-medium">{{ i18n.pick(team.nameAr, team.nameEn) }}</span>
                <span class="block text-xs text-muted-foreground" dir="ltr">{{ team.code }}</span>
              </td>
              <td appTableCell>{{ team.managerId ? name(team.managerId) : '—' }}</td>
              <td appTableCell class="tabular">{{ i18n.formatNumber(team.memberIds.length) }}</td>
              <td appTableCell>{{ team.region || '—' }}</td>
              <td appTableCell><app-badge [tone]="team.isActive ? 'success' : 'neutral'">{{ (team.isActive ? 'admin.active' : 'admin.inactive') | t }}</app-badge></td>
              <td appTableCell><button type="button" appButton variant="ghost" size="sm" (click)="edit(team)">{{ 'crm.common.edit' | t }}</button></td>
            </tr>
          } @empty {
            @if (data.isLoading()) {
              @for (i of [0, 1, 2, 3, 4]; track i) {
                <tr app-skeleton-row [columns]="6" [index]="i"></tr>
              }
            } @else {
              <tr app-table-empty [colSpan]="6">{{ 'admin.empty' | t }}</tr>
            }
          }
        </tbody>
      </table>
    </app-table-wrapper>

    <app-dialog [(open)]="open" [heading]="(editing() ? 'admin.teams.edit' : 'admin.teams.new') | t">
      <form class="grid gap-4 sm:grid-cols-2" (submit)="save($event)">
        @if (actions.error(); as text) {
          <app-alert variant="destructive" class="sm:col-span-2">{{ text }}</app-alert>
        }
        <div>
          <label appLabel for="t-code" required>{{ 'admin.code' | t }}</label>
          <input appInput id="t-code" dir="ltr" [disabled]="!!editing()" [value]="d().code" (input)="set('code', $any($event.target).value.trim().toLowerCase())" />
        </div>
        <div>
          <label appLabel for="t-region">{{ 'admin.teams.region' | t }}</label>
          <input appInput id="t-region" [value]="d().region" (input)="set('region', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="t-ar" required>{{ 'admin.nameAr' | t }}</label>
          <input appInput id="t-ar" dir="rtl" [value]="d().nameAr" (input)="set('nameAr', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="t-en" required>{{ 'admin.nameEn' | t }}</label>
          <input appInput id="t-en" dir="ltr" [value]="d().nameEn" (input)="set('nameEn', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="t-manager">{{ 'admin.users.manager' | t }}</label>
          <app-user-select inputId="t-manager" [value]="d().managerId" (valueChange)="set('managerId', $event)" />
        </div>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="d().isActive" (change)="setActive($any($event.target).checked)" /> {{ 'admin.active' | t }}</label>
        <fieldset class="sm:col-span-2">
          <legend class="mb-1 text-sm font-medium">{{ 'admin.teams.members' | t }}</legend>
          <div class="flex flex-col gap-2">
            @for (member of d().memberIds; track member; let index = $index) {
              <div class="flex items-center gap-2">
                <app-user-select class="flex-1" [inputId]="'t-member-' + index" [value]="member" (valueChange)="setMember(index, $event)" />
                <button type="button" appButton variant="ghost" size="sm" (click)="removeMember(index)">{{ 'crm.common.delete' | t }}</button>
              </div>
            }
            <button type="button" appButton variant="outline" size="sm" class="self-start" (click)="addMember()">{{ 'admin.teams.addMember' | t }}</button>
          </div>
        </fieldset>
        <div class="flex gap-2 sm:col-span-2">
          <button type="submit" appButton [disabled]="actions.busy() || !valid()">{{ 'crm.common.save' | t }}</button>
          <button type="button" appButton variant="outline" (click)="open.set(false)">{{ 'crm.common.cancel' | t }}</button>
        </div>
      </form>
    </app-dialog>
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class TeamsAdminPage {
  private readonly api = inject(AdminApi);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  protected readonly data = rxResource({ stream: () => this.api.teams() });
  protected readonly open = signal(false);
  protected readonly editing = signal<string | null>(null);
  protected readonly d = signal({ code: '', nameAr: '', nameEn: '', region: '', managerId: '', memberIds: [] as string[], isActive: true });
  protected readonly valid = computed(() => /^[a-z][a-z0-9_-]{1,40}$/.test(this.d().code) && !!this.d().nameAr.trim() && !!this.d().nameEn.trim());

  protected name(value: Parameters<typeof userName>[1]): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value);
  }

  protected edit(team: Team | null): void {
    this.actions.error.set(null);
    this.editing.set(team?.id ?? null);
    this.d.set(
      team
        ? { code: team.code, nameAr: team.nameAr, nameEn: team.nameEn, region: team.region ?? '', managerId: idOf(team.managerId), memberIds: team.memberIds.map(idOf), isActive: team.isActive }
        : { code: '', nameAr: '', nameEn: '', region: '', managerId: '', memberIds: [], isActive: true },
    );
    this.open.set(true);
  }

  protected set(key: 'code' | 'nameAr' | 'nameEn' | 'region' | 'managerId', value: string): void {
    this.d.update((d) => ({ ...d, [key]: value }));
  }

  protected setActive(value: boolean): void {
    this.d.update((d) => ({ ...d, isActive: value }));
  }

  protected addMember(): void {
    this.d.update((d) => ({ ...d, memberIds: [...d.memberIds, ''] }));
  }

  protected setMember(index: number, value: string): void {
    this.d.update((d) => ({ ...d, memberIds: d.memberIds.map((m, i) => (i === index ? value : m)) }));
  }

  protected removeMember(index: number): void {
    this.d.update((d) => ({ ...d, memberIds: d.memberIds.filter((_, i) => i !== index) }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    const d = this.d();
    const body = { nameAr: d.nameAr.trim(), nameEn: d.nameEn.trim(), region: d.region || undefined, managerId: d.managerId || null, memberIds: [...new Set(d.memberIds.filter(Boolean))], isActive: d.isActive };
    const id = this.editing();
    const request: Observable<Team> = id ? this.api.updateTeam(id, body) : this.api.createTeam({ ...body, code: d.code });
    void this.actions.run(request, 'admin.saved', () => {
      this.open.set(false);
      this.data.reload();
    });
  }
}

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
  templateUrl: './teams-admin.page.html',
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

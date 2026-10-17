import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ImageUp, X } from 'lucide';
import { of, catchError, type Subscription } from 'rxjs';

import { UnsavedChanges, type HasUnsavedChanges } from '../../../core/forms/unsaved-changes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SaveShortcutDirective } from '../../../core/shortcuts/save-shortcut.directive';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import type { SupportTicketCategory } from '../models/support-ticket.interface';
import { acceptAttribute, DEFAULT_ATTACHMENT_POLICY, type ScreenshotProblem, screenshotProblem } from '../shared/screenshot-checks';
import { DEFAULT_SUPPORT_SEVERITY, fileSize, SUPPORT_CATEGORIES, SUPPORT_SEVERITIES } from '../shared/support-display';
import { SupportApi } from '../support-api.service';

/** Limits the API enforces too (SUPPORT_TITLE_MAX / SUPPORT_DESCRIPTION_MAX). */
const TITLE_MAX = 150;
const DESCRIPTION_MAX = 5000;

interface SelectedScreenshot {
  id: number;
  file: File;
  /** Local preview (an object URL — nothing is uploaded before the ticket is submitted). */
  previewUrl: string;
  problem: ScreenshotProblem | null;
}

const EMPTY = { title: '', description: '', category: 'other' as SupportTicketCategory, severity: DEFAULT_SUPPORT_SEVERITY };

/**
 * Report a problem: title, description, type and optional screenshots. The
 * screenshots stay in the browser (previews only) until the ticket is
 * submitted, then travel with it in one request — an abandoned form stores
 * nothing. The browser checks type, size and count for quick feedback; the
 * API checks the actual files again.
 */
@Component({
  selector: 'app-support-ticket-form-page',
  imports: [SaveShortcutDirective, BreadcrumbsComponent, TranslatePipe, AlertComponent, ButtonDirective, IconComponent, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './support-ticket-form.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class SupportTicketFormPage implements HasUnsavedChanges {
  private readonly api = inject(SupportApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly icons = { upload: ImageUp, remove: X };
  protected readonly categories = SUPPORT_CATEGORIES;
  protected readonly severities = SUPPORT_SEVERITIES;
  protected readonly titleMax = TITLE_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;

  protected readonly form = signal({ ...EMPTY });
  protected readonly screenshots = signal<SelectedScreenshot[]>([]);
  protected readonly attempted = signal(false);
  protected readonly dragging = signal(false);
  protected readonly busy = signal(false);
  /** 0–1 while the request is being sent. */
  protected readonly progress = signal(0);
  protected readonly error = signal<string | null>(null);
  /** Files dropped beyond the limit (not added). */
  protected readonly overflow = signal(false);

  private readonly policyResource = rxResource({ stream: () => this.api.attachmentPolicy().pipe(catchError(() => of(DEFAULT_ATTACHMENT_POLICY))) });
  protected readonly policy = computed(() => (this.policyResource.hasValue() ? this.policyResource.value() : DEFAULT_ATTACHMENT_POLICY));
  protected readonly accept = computed(() => acceptAttribute(this.policy()));
  protected readonly limits = computed(() => ({
    types: 'PNG, JPG, WebP',
    count: this.policy().maxAttachments,
    size: fileSize(this.i18n, this.policy().maxAttachmentBytes),
  }));

  protected readonly titleError = computed(() => (this.attempted() && !this.form().title.trim() ? 'support.validation.titleRequired' : null));
  protected readonly descriptionError = computed(() => (this.attempted() && !this.form().description.trim() ? 'support.validation.descriptionRequired' : null));
  protected readonly hasFileProblems = computed(() => this.screenshots().some((shot) => shot.problem));
  protected readonly canSubmit = computed(() => !this.busy() && !!this.form().title.trim() && !!this.form().description.trim() && !this.hasFileProblems());
  protected readonly crumbs = computed(() => [{ label: this.i18n.t('navigation.items.support'), path: '/support' }, { label: this.i18n.t('support.newTitle') }]);

  private nextId = 0;
  private saved = false;
  private submission: Subscription | null = null;

  constructor() {
    inject(UnsavedChanges).track(() => this.hasUnsavedChanges());
    inject(DestroyRef).onDestroy(() => {
      this.submission?.unsubscribe();
      for (const shot of this.screenshots()) URL.revokeObjectURL(shot.previewUrl);
    });
  }

  hasUnsavedChanges(): boolean {
    return !this.saved && (JSON.stringify(this.form()) !== JSON.stringify(EMPTY) || this.screenshots().length > 0);
  }

  protected set(key: keyof typeof EMPTY, value: string): void {
    this.form.update((form) => ({ ...form, [key]: value }));
  }

  protected problemText(shot: SelectedScreenshot): string {
    return shot.problem ? this.i18n.t(`support.screenshots.${shot.problem}`, { name: shot.file.name, size: this.limits().size }) : '';
  }

  protected size(bytes: number): string {
    return fileSize(this.i18n, bytes);
  }

  protected browse(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.add(Array.from(input.files ?? []));
    input.value = ''; // choosing the same file again still fires `change`
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (!this.busy()) this.add(Array.from(event.dataTransfer?.files ?? []));
  }

  protected dragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  /** Adds files up to the limit; anything beyond it is refused with a message. */
  protected add(files: File[]): void {
    const room = this.policy().maxAttachments - this.screenshots().length;
    this.overflow.set(files.length > room);
    const added = files.slice(0, Math.max(0, room)).map((file) => ({ id: this.nextId++, file, previewUrl: URL.createObjectURL(file), problem: screenshotProblem(file, this.policy()) }));
    if (added.length) this.screenshots.update((current) => [...current, ...added]);
  }

  protected remove(shot: SelectedScreenshot): void {
    URL.revokeObjectURL(shot.previewUrl);
    this.screenshots.update((current) => current.filter((candidate) => candidate.id !== shot.id));
    this.overflow.set(false);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.attempted.set(true);
    if (!this.canSubmit()) return;
    const form = this.form();
    this.busy.set(true);
    this.error.set(null);
    this.progress.set(0);
    this.submission = this.api
      .create({ title: form.title.trim(), description: form.description.trim(), category: form.category, severity: form.severity, screenshots: this.screenshots().map((shot) => shot.file) })
      .subscribe({
        next: ({ progress, result }) => {
          this.progress.set(progress);
          if (!result) return;
          this.saved = true;
          void this.router.navigate(['/', this.i18n.locale(), 'support', result.id], { state: { supportNotice: 'support.notices.created' } });
        },
        error: (error: unknown) => {
          this.error.set(this.i18n.errorText(error));
          this.busy.set(false);
        },
        complete: () => this.busy.set(false),
      });
  }
}

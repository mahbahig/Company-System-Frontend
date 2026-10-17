import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Service, computed, inject, isDevMode, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { LocalStore } from '../storage/local-store.service';
import { DEFAULT_LOCALE, TIME_ZONE, directionFor, type Locale } from './locale';
import type { MessageCatalogue } from './message-catalogue.interface';

const LOCALE_KEY = 'ecotech.locale';
const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Message keys returned by the API (`errors.*`, `validation.*`,
 * `auth.errors.*`) live under `server.*` in the catalogues, so they never
 * collide with page-level keys such as `errors.notFound.title`.
 */
function serverKey(key: string): string {
  if (key.startsWith('auth.errors.')) return `server.auth.${key.slice('auth.errors.'.length)}`;
  if (key.startsWith('errors.') || key.startsWith('validation.')) return `server.${key}`;
  return key;
}

/**
 * Runtime AR/EN translations using the SAME catalogues as the Next.js app
 * (`messages/ar.json`, `messages/en.json`, served under `/i18n/`).
 *
 * The active locale is a signal: templates re-render when it changes, and
 * `<html lang dir>` is kept in sync so Arabic is right-to-left everywhere.
 */
@Service()
export class I18nService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly store = inject(LocalStore);

  private readonly catalogues = signal<Partial<Record<Locale, MessageCatalogue>>>({});
  private readonly loading = new Map<Locale, Promise<void>>();

  readonly locale = signal<Locale>(DEFAULT_LOCALE);
  readonly direction = computed(() => directionFor(this.locale()));
  readonly isRtl = computed(() => this.direction() === 'rtl');

  private readonly messages = computed(() => this.catalogues()[this.locale()] ?? {});

  /** Loads the catalogue (once) and makes `locale` the active language. */
  async use(locale: Locale): Promise<void> {
    await this.load(locale);
    this.locale.set(locale);
    this.store.set(LOCALE_KEY, locale);
    const html = this.document.documentElement;
    html.lang = locale;
    html.dir = directionFor(locale);
  }

  /** Last language the user chose (for `/` → `/<locale>/…`). */
  preferredLocale(): Locale {
    const stored = this.store.get(LOCALE_KEY);
    return stored === 'ar' || stored === 'en' ? stored : DEFAULT_LOCALE;
  }

  /**
   * Translates a dotted key, e.g. `auth.login.title`, replacing `{name}`
   * placeholders. A missing key renders as the key itself (and warns in dev)
   * so a gap is visible instead of silently blank.
   */
  t(key: string, params?: Record<string, string | number | null | undefined>): string {
    const value = this.lookup(this.messages(), key) ?? this.lookup(this.messages(), serverKey(key));
    if (value === undefined) {
      if (isDevMode() && Object.keys(this.messages()).length) console.warn(`[i18n] missing "${key}" (${this.locale()})`);
      return key;
    }
    return params ? value.replace(PLACEHOLDER, (match, name: string) => String(params[name] ?? match)) : value;
  }

  /** True when the key exists — used to fall back from API error keys. */
  has(key: string): boolean {
    return this.lookup(this.messages(), key) !== undefined || this.lookup(this.messages(), serverKey(key)) !== undefined;
  }

  /** Human message for any failure (an ApiError's key, a server key, or an unknown error). */
  errorText(error: unknown): string {
    const key = typeof error === 'string' ? error : (error as { messageKey?: string } | null)?.messageKey;
    const text = key && this.has(key) ? this.t(key) : this.t('server.errors.unexpected');
    const fields = this.problemFields(error);
    return fields.length ? `${text} (${fields.join(this.locale() === 'ar' ? '، ' : ', ')})` : text;
  }

  /** Names of the fields behind a validation / gate error, so the message says what to fix. */
  private problemFields(error: unknown): string[] {
    if (!error || typeof error !== 'object') return [];
    const { fieldErrors, details } = error as { fieldErrors?: Record<string, string>; details?: { missing?: Array<{ id?: string; field?: string }> } };
    const names = [...Object.keys(fieldErrors ?? {}), ...(details?.missing ?? []).map((item) => item.id ?? item.field ?? '')].filter(Boolean);
    return [...new Set(names)].slice(0, 8).map((name) => (this.has(`completeness.items.${name}`) ? this.t(`completeness.items.${name}`) : name));
  }

  /** Picks the Arabic or English variant of a bilingual field. */
  pick(ar: string | null | undefined, en: string | null | undefined): string {
    return (this.locale() === 'ar' ? ar || en : en || ar) ?? '';
  }

  formatNumber(value: number | null | undefined, options: Intl.NumberFormatOptions = { maximumFractionDigits: 2 }): string {
    return value == null || !Number.isFinite(value) ? '' : new Intl.NumberFormat(this.intlLocale(), options).format(value);
  }

  /** EGP without piastres — solar contracts run to millions (Next `formatMoney`). */
  formatMoney(value: number | null | undefined, currency = 'EGP'): string {
    return this.formatNumber(value, { style: 'currency', currency, maximumFractionDigits: 0 });
  }

  /** Compact money for board totals, e.g. "EGP 1.2M" (Next `formatMoneyCompact`). */
  formatMoneyCompact(value: number | null | undefined, currency = 'EGP'): string {
    return this.formatNumber(value, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
  }

  /** Date (optionally with time) in Cairo time; times on the 12-hour clock with AM/PM ("Oct 17, 2026, 2:45 PM"). */
  formatDate(value: string | Date | null | undefined, withTime = false): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat(this.intlLocale(), {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      ...(withTime ? { hour: 'numeric', minute: '2-digit', hour12: true } : {}),
      timeZone: TIME_ZONE,
    }).formatToParts(date);
    // en-GB writes "pm": the day period is always shown as AM / PM (Arabic keeps ص / م).
    return parts.map((part) => (part.type === 'dayPeriod' ? part.value.toUpperCase() : part.value)).join('');
  }

  /** "10 seconds ago", "in 2 days" — for drafts, notifications and other recent moments. */
  formatRelative(value: string | Date | number | null | undefined, now: number = Date.now()): string {
    if (value == null || value === '') return '';
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return '';
    const seconds = Math.round((time - now) / 1000);
    const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ['second', 60],
      ['minute', 60],
      ['hour', 24],
      ['day', 7],
      ['week', 4.35],
      ['month', 12],
      ['year', Number.POSITIVE_INFINITY],
    ];
    let amount = seconds;
    for (const [unit, size] of steps) {
      if (Math.abs(amount) < size) return new Intl.RelativeTimeFormat(this.intlLocale(), { numeric: 'auto' }).format(Math.round(amount), unit);
      amount /= size;
    }
    return '';
  }

  /** Arabic with Latin digits (Gregorian is ar-EG's default calendar), matching the Next app. */
  private intlLocale(): string {
    return this.locale() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  }

  private load(locale: Locale): Promise<void> {
    if (this.catalogues()[locale]) return Promise.resolve();
    let pending = this.loading.get(locale);
    if (!pending) {
      pending = firstValueFrom(this.http.get<MessageCatalogue>(`i18n/${locale}.json`)).then((catalogue) =>
        this.catalogues.update((all) => ({ ...all, [locale]: catalogue })),
      );
      this.loading.set(locale, pending);
    }
    return pending;
  }

  private lookup(catalogue: MessageCatalogue, key: string): string | undefined {
    let node: string | MessageCatalogue | undefined = catalogue;
    for (const part of key.split('.')) {
      if (node === undefined || typeof node === 'string') return undefined;
      node = node[part];
    }
    return typeof node === 'string' ? node : undefined;
  }
}

# EcoTech CRM — frontend (Angular 22)

Bilingual (Arabic RTL / English) web client for the NestJS API in `../backend`.
The UI reproduces the existing Next.js app exactly; see `../FRONTEND.md` for the
feature inventory and `../PROGRESS.md` for status and conventions.

## Run

```bash
# 1. API on :3000 (see ../backend/README.md), then:
npm install
npm start          # syncs i18n, then ng serve on http://localhost:4200 (proxies /api → :3000)
npm run build      # production build → dist/frontend
```

Demo accounts (from the backend seed): `admin@`, `manager@`, `rep1@ecotech.demo` … password `Password123!`.

## Structure

```
src/app
├── core/        singletons: api, auth, i18n, theme, layout (shell), navigation, notifications, reference data
├── shared/      ui kit (button, badge, card, table, form controls …), crm widgets (list toolbar, pagination,
│                completeness panel, detail item), utils
└── features/    lazy pages per domain: auth, dashboard, customers, errors, …
```

## Conventions (summary — full list in ../PROGRESS.md §2)

- Angular 22 defaults: standalone, OnPush, zoneless — do not restate them in decorators.
- Singleton services use `@Service()`; `inject()` everywhere; signals + `rxResource` for data.
- Forms use Signal Forms (`@angular/forms/signals`).
- One class **or** interface per file; models live in `features/<domain>/models/`.
- Every code value shown to users goes through `ReferenceDataService.label()` — never render raw codes.
- Accessibility is a requirement: pages must pass axe-core (WCAG 2.1 AA) in both languages and themes.

## i18n

Catalogues come from the repo-root `messages/ar.json` and `messages/en.json` (shared with the Next app).
Keys that only the new app needs go in `src/i18n/<locale>.extra.json`. `npm run i18n:sync` merges both
into `public/i18n/` (generated — do not edit); it runs automatically before `start` and `build`.

## Navigation

`core/navigation/nav-sections.ts` declares the menu. An item is shown only when the user holds its
permission **and** a route for its path exists, so registering a feature route is what adds it to the sidebar.

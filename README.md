# Ecotech — Frontend

Bilingual (Arabic RTL / English LTR) web client for Ecotech, a
solar / renewable-energy company. It covers the full commercial lifecycle —
leads → opportunities → assessments → proposals → contracts → projects — plus the
supporting activity, approval, reporting and administration tooling.

Built with **Angular 22** (standalone, zoneless, signals) and **Tailwind CSS v4**.
It talks to a separate NestJS REST API over `/api/v1`.

- **Repository:** https://github.com/mahbahig/Company-System-Frontend
- **Full specification:** [`FINAL_SRS_FRONTEND.md`](./FINAL_SRS_FRONTEND.md) — the complete
  Software Requirements Specification (screens, permissions, data contracts).

---

## Table of contents

- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [npm scripts](#npm-scripts)
- [Backend & environment](#backend--environment)
- [Project structure](#project-structure)
- [Routing & features](#routing--features)
- [Internationalization (i18n)](#internationalization-i18n)
- [Theming & design tokens](#theming--design-tokens)
- [Sign-in experience](#sign-in-experience)
- [Decorative 3D](#decorative-3d)
- [Architecture & conventions](#architecture--conventions)
- [Accessibility](#accessibility)
- [Build & deployment](#build--deployment)
- [Git workflow](#git-workflow)

---

## Tech stack

| Area           | Choice                                                        |
| -------------- | ------------------------------------------------------------- |
| Framework      | Angular 22 — standalone components, **zoneless**, OnPush, signals |
| Language       | TypeScript (strict)                                           |
| Styling        | Tailwind CSS v4 via PostCSS (`@tailwindcss/postcss`)          |
| Routing        | `@angular/router` with lazy-loaded feature routes + view transitions |
| Data           | `HttpClient` (fetch) + signal-based resources                 |
| Icons          | [`lucide`](https://lucide.dev)                                |
| UI variants    | `class-variance-authority`                                    |
| CDK            | `@angular/cdk` (a11y, overlay)                                |
| 3D             | [`three`](https://threejs.org) — the sign-in scene and the decorative pieces, always `@defer`-loaded |
| Formatting     | Prettier                                                      |

## Prerequisites

- **Node.js** 20.19+ or 22.12+ (Angular 22 requirement; developed on Node 22).
- **npm** 10+.
- A running instance of the **backend API** on `http://localhost:3000` (see
  [Backend & environment](#backend--environment)).

## Getting started

```bash
# install dependencies
npm install

# start the dev server (http://localhost:4200)
#   - runs the i18n sync first (prestart hook)
#   - proxies /api → http://localhost:3000 (proxy.conf.json)
npm start

# production build → dist/frontend
npm run build
```

Open http://localhost:4200. Unauthenticated users are redirected to
`/login`. URLs never carry the language: it is the browser's choice, kept in
localStorage (`ecotech.locale`).

> Credentials come from the backend's seed data — ask your backend setup for the
> demo accounts and password.

## npm scripts

| Script              | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| `npm start`         | Dev server (`ng serve`); `prestart` syncs i18n catalogues first.        |
| `npm run build`     | Production build to `dist/frontend`; `prebuild` syncs i18n first.       |
| `npm run watch`     | Development build in watch mode.                                        |
| `npm test`          | Unit tests (`ng test`, Vitest + jsdom); `ng test --watch=false` in CI.  |
| `npm run i18n:sync` | Regenerate `public/i18n/<locale>.json` from the source catalogues.      |

## Backend & environment

This is a frontend-only repository; it expects a REST API speaking the contracts
in [`FINAL_SRS_FRONTEND.md`](./FINAL_SRS_FRONTEND.md).

- **API base URL** is configured in `src/environments/environment.ts` as
  `apiBaseUrl: '/api/v1'` — a relative path.
- In development, `ng serve` proxies `/api` to `http://localhost:3000` via
  [`proxy.conf.json`](./proxy.conf.json). Point it elsewhere by editing that file.
- In production, serve the built app and the API from the same origin (or put a
  reverse proxy in front so `/api` reaches the backend).

## Project structure

```
.
├── public/                     static assets (icon, PWA manifest, push service worker)
│   └── i18n/                    generated locale catalogues (do not edit — see i18n)
├── scripts/
│   ├── sync-messages.mjs        merges i18n sources → public/i18n
│   └── build-wordmark-glyphs.mjs  regenerates the Ecotech logotype's glyphs (2D and 3D)
├── src/
│   ├── main.ts                  standalone bootstrap
│   ├── index.html
│   ├── styles.css               global Tailwind theme + design tokens
│   ├── environments/            build-time config (apiBaseUrl, badge)
│   ├── i18n/                     i18n source catalogues (base / per-locale / fragments)
│   └── app/
│       ├── app.ts               root component
│       ├── app.config.ts        providers (router, HttpClient, interceptors, title strategy)
│       ├── app.routes.ts        top-level, locale-prefixed route map
│       ├── core/                app-wide singletons
│       │   ├── api/             typed HTTP client + error interceptor
│       │   ├── auth/            session, guards (auth/guest/permission), auth interceptor
│       │   ├── i18n/            translate pipe/service, locale guards, title strategy
│       │   ├── layout/          app shell (sidebar + header), chrome widgets
│       │   ├── navigation/      permission-filtered sidebar menu model
│       │   ├── chat/            conversations store, chat REST API, socket commands
│       │   ├── notifications/   in-app notifications (live over the realtime connection)
│       │   ├── realtime/        the one Socket.IO connection, forced logout / system lock reactions
│       │   ├── reference/       reference-data cache + label() lookups
│       │   ├── storage/         persistent storage wrapper
│       │   └── theme/           light/dark theme service
│       ├── shared/
│       │   ├── ui/              primitives: button, card, dialog, table, tabs, form, badge,
│       │   │                    icon, alert, page-header, stat-card
│       │   ├── crm/             record widgets: timeline, documents panel, saved views,
│       │   │                    list toolbar, pagination, record picker, completeness
│       │   │                    panel, GPS capture, status badge, user select, …
│       │   └── utils/
│       └── features/            one lazy-loaded area per domain (see below)
├── angular.json
├── proxy.conf.json
├── tsconfig*.json
└── FINAL_SRS_FRONTEND.md        full requirements specification
```

## Routing & features

Every page has one address in both languages (`/customers`, `/employees`, …) —
the language lives in localStorage, never in the URL (see Internationalization).
Public, sign-in, and authenticated routes are separated by guards, and each
authenticated page declares a `data.permission` that gates it in the UI (the API
re-checks everything server-side). Which role opens which page is documented in
[`../Backend/docs/ACCESS_CONTROL.md`](../Backend/docs/ACCESS_CONTROL.md).

| Guard             | Purpose                                                      |
| ----------------- | ------------------------------------------------------------ |
| `authGuard`       | Requires an authenticated session for the app shell.         |
| `guestGuard`      | Keeps signed-in users out of login / password pages.         |
| `permissionGuard` | Enforces `data.permission` (any of) and `data.requiresAll` (every) on each route level; fails closed. |

Feature areas (all lazy-loaded under the authenticated app shell):

- **Dashboard** — the dashboards each role opens (personal, executive, sales …). The Super
  Administrator's `/dashboard` is operational instead: `SupportOverviewComponent` (new and critical
  tickets from `GET /support/tickets/stats`, each opening the desk filtered alike) and platform
  health — no business KPIs or quick links there; their business pages stay in the navigation.
- **Customers** — list, 360° detail, form, contacts, sites.
- **Leads** — list, "my leads", detail, form, quick-add, convert, distribute.
- **Opportunities & Pipeline** — list/detail/form and a kanban pipeline board.
- **Assessments** — site assessment list and detail.
- **Proposals** — technical, financial and combined proposals, compare view and a
  workspace; plus a public, tokenized share page at `/p/:token` (no sign-in).
- **Contracts** — contract list and detail.
- **Projects** — delivery project list and detail.
- **Activities** — calls, meetings, visits, and a combined activity log.
- **Tasks** — list (My Tasks by default; Team Tasks for team managers), detail, form.
- **Handoffs** — sales → delivery handoff inbox and detail.
- **Approvals** — approval queues and delegations.
- **Campaigns** — marketing campaigns.
- **Imports** — bulk data imports.
- **Reports** / **Analytics** — reporting, search, and an exceptions center.
- **Admin** — users, roles, teams, reference data, equipment, rules, automation,
  duplicates, ownership requests, intake forms, integrations, audit, settings.
- **Security Center** (`/admin/security`, Super Administrators only — `audit.view_security`; the API checks the role
  too): System Status (Normal / Maintenance Mode / Locked with the lock and maintenance switches — the same
  `app-system-status-card` as on Settings), the overview (real counts), recent security activity, security alerts
  (server-paged, Acknowledge / Resolve with contextual confirmations; `/admin/security/alerts/:id`) and system health
  (one card per component, Details, Refresh; polled every 30 s while visible).
- **Realtime (Socket.IO)** — `core/realtime`: `RealtimeService` owns the ONE Socket.IO connection per tab
  (`/api/v1/socket.io`, WebSocket only — no Server-Sent Events, no polling), open while signed in (past forced
  steps, page shown, no maintenance). The in-memory access token goes in the handshake `auth` callback (refreshed
  first when about to expire) — never the URL. Every listener is registered once by the service; components use
  `on(type)` and unsubscribe with their lifetime, so nothing is received twice. A refused connection says why:
  a session that is over signs out with its reason, maintenance shows its screen, an expired token is refreshed
  and the connection retried with back-off. `SecurityEvents`: `FORCE_LOGOUT` (logged out of all sessions, this
  session ended, the password changed elsewhere, the account deactivated) signs out at once with the matching
  notice — idempotent, so a 401 arriving right after changes nothing; `SYSTEM_LOCKED` signs out anyone but a Super
  Administrator — the sign-in page says "The system has been locked by {name}" (the name from the event, kept in
  memory, never in the URL); a Super Administrator stays and gets a toast, the bell refreshes and the System Status
  card reloads. Notifications arrive live (`NOTIFICATION_CREATED`). A missed event changes nothing for security: the
  API already ended the session and refuses it.
- **Meeting location verification** — `features/activities/meetings`: "Start meeting" / "End meeting" (the owner
  only) read the device position once each through `core/geo` `GeolocationService` (`getCurrentPosition`, high
  accuracy, `maximumAge: 0`, a timeout — never `watchPosition`) and send only latitude, longitude and accuracy;
  denied / unavailable / timed out / unsupported each say so and nothing is started or ended. The location card
  shows the API's verdict (verified / changed / unreliable / unavailable for older meetings) and, when the API sent
  coordinates (`meetings.view_locations`), one Google Map (`core/maps` `GoogleMapsLoader`, key from
  `GET /maps/config`): start (green), end (red), the radius around the start, the line between, fitted to view.
- **Chat** — `features/chat` (`/chat`, `/chat/:chatId`) and `core/chat`: the conversation list (unread counts, live),
  private chats, the company chat, team chats and custom groups (create with a typed name and ≥ 2 colleagues;
  members, admins, admin-only and rename for the group's admins — controls shown from the API's `capabilities`).
  History is never downloaded whole: `ConversationStore` opens on the latest 50 messages, loads the batch before /
  after by position as the reader nears an edge (well before it), keeps at most 300 messages in memory and in the
  page, and dedupes by id. `MessageListComponent` puts the first visible message back exactly where it was after
  each batch (browser scroll anchoring off) and shows "new messages" instead of moving a reader who is scrolled up.
  In-conversation search is the API's (debounced 350 ms, batches of 20, "load more"); a result anywhere in the
  history opens with one context request and is highlighted. Super Administrators get `/admin/chats` (group
  metadata, lock / unlock / delete — Delete also on a row's right-click, for custom groups and team chats only;
  no message content anywhere). Only your own messages have actions — Edit (the composer switches to editing) and
  Delete (confirmed) — by right-click, long press or their "⋯" button; anyone else's message keeps the browser's
  menu (the API allows the sender only). Ticks: Sending → Sent → Delivered → Seen, Seen in `text-chat-seen` (the
  success hue tuned per theme to read on your own bubble) with a bolder stroke; each device reports what it received
  (`ChatStore.reportDelivered`, gathered into one `chat:delivered:many`). A conversation's menu (right-click, long
  press, "⋯") offers Archive / Unarchive (`capabilities.archive`; stored on the server, `chat:archived` to your
  other devices); archived conversations sit in their own "Archived" view. The Create Group name is required (red
  asterisk, trimmed). Members never delete a conversation.
- **Maintenance** — `maintenanceInterceptor` turns any 503 `errors.maintenance` / `auth.errors.maintenance` into the
  full-screen maintenance page (`core/maintenance`), which polls `GET /system/availability` and reloads when it is
  over; a Super Administrator sees a reminder banner instead.
- **Audit detail** — changes read field by field, before → after in words (`audit-diff.ts`: field labels, Active /
  Inactive, role and status names, 12-hour dates); a secret only as "changed"; the raw snapshots only in the collapsed
  technical details. The audit log shows an employee filter as "Employee: <name>" (removable).
- **Tables** — every table is paged (`shared/crm/pagination`): Items per page 10 / 20 / 50 / 100 (default 20)
  above the table (`<app-page-size>`, or `<app-pager-size>` for a `LocalPager`), and the one centred footer under
  it (Previous / pages / Next, "Showing x–y of z"). List pages keep `?page=` and
  `?pageSize=` in the URL and send both to the API; embedded server lists use `PagerState`; a record's bounded
  sub-lists and small configuration sets use `LocalPager` + `<app-pager>`. Search / filters reset to page 1; a
  page emptied by a deletion moves back; controls are disabled while a page loads.
- **Confirmations** — `ConfirmService.confirm({ heading, message, details?, irreversible?, confirmLabel,
  cancelLabel, variant: 'danger' | 'warning' | 'default', requireText?, action? })`: contextual (the action and
  record, the consequence, a button named after the action — never "Are you sure?" / "OK"); with `action` the
  request runs inside the dialog (busy, no double submit, closes only on success, shows the error otherwise).
  The API authorizes every action; the dialog is UX only.
- **Context menus** — one menu for the app (`shared/ui/context-menu`): `[appContextMenu]="() => actions"` opens it on
  right-click, a long press (touch) and the keyboard's menu key / Shift+F10; an overflow "⋯" button calls
  `ContextMenuService.toggleFrom(...)`. The shell's `<app-context-menu-host>` renders it at the pointer, kept inside
  the viewport (flipped as needed, RTL-aware), focus on the first action, arrows / Home / End, Escape / Tab / a click
  elsewhere / scroll / resize to close. List only the actions the API allows; with none, nothing opens and the
  browser keeps its own menu.
- **Create actions** — `<app-create-icon />` before the label of every create / add action ("+ New Employee",
  "+ Add Milestone"), also in list empty states, shown only with the permission the API requires.
- **Audit log** (Super Administrator) — date and time on the 12-hour clock, who did it ("System" for jobs,
  "Not signed in" for unauthenticated requests), the readable action from the API (`actionLabel`, never the
  code); every row opens `/admin/audit/:id` (click or Enter); `?userId=` filters to one employee (an employee's
  "View Audit Logs").
- **Session credentials** — the access token lives in memory only (`TokenStore`); the refresh token
  is the API's HttpOnly `SameSite=Strict` cookie, which no script can read: `auth/refresh` is a POST
  with no body and `withCredentials`, and the API rotates the cookie each time. A reload resumes the
  session through that refresh; a password change adopts the new access token it answers (the old
  one stops working). Nothing credential-like is stored in localStorage (an older build's
  `ecotech.session` is deleted at start-up).
- **Expired sessions** — `authInterceptor` (the one HTTP hook): a 401 for an expired access token
  refreshes it once through `AuthService.refreshAccessToken` (concurrent failures share one refresh;
  the refresh call itself is never retried) and replays the request; when the refresh fails, or the API says the session is over
  (`sessionEndReason`: revoked, password changed elsewhere, account deactivated, expired),
  `SessionExpiry.end` clears the tokens and the signed-in user (once, however many requests failed)
  and opens sign-in with `?reason=` — each reason has its own notice. Signing out sends
  `QUIET_SESSION_END`, so it never shows "expired". `authGuard` drops a session the API no
  longer accepts (reload / deep link) and says why (the refused refresh's reason, else "expired").
- **Profile** — `/account/profile` for every user (`/account` opens it; user menu and palette):
  account details from `/auth/me`, the shared `ChangePasswordFormComponent` (also the forced
  first-login page `/account/password`; other sessions end, this one stays), and their own active
  sessions (`SessionListComponent`: current first, no Log out on it, no "log out all"). The
  employee page (`/employees/:id`) shows the same list for `security.view_sessions` with Log out and
  Log out all sessions (`EmployeeSessionsComponent`) — never for a Super Administrator
  (`isSuperAdministrator`, mirroring the API) or oneself; the Employees list hides lock / reset /
  log-out-all on Super Administrator rows. `index.html` sends `Accept-CH: Sec-CH-UA-Platform-Version`
  so sessions can say "Windows 11".
- **Severity** — every support ticket has one (`SUPPORT_SEVERITIES`, `SupportSeverityBadgeComponent`:
  critical is red with a warning icon); the form picks it (medium by default) and the desk filters by
  it (`?severity=`, applied by the API).
- **Dialogs** — `DialogComponent` keeps its title and ✕ fixed; only the body scrolls inside the dialog.
- **Help & Support** — every employee reports problems (`/support`: My tickets, a
  new-ticket form with screenshot drop zone, previews and upload progress, and the
  ticket conversation). The System Administrator files no tickets (the nav item is
  `hiddenWith: 'support.manage'`; `notSupportDeskGuard` sends `/support` and
  `/support/new` to the desk); its desk is `/admin/support-tickets`
  (search by title / number / name / e-mail, status filter, resolve / reopen,
  delete one or all with a typed `DELETE ALL`). Management controls follow the
  ticket's server-computed `permissions`; screenshots load from short-lived signed
  links (`SupportApi.attachmentUrl`).
- **Account** — password, security, notification preferences.
- **Notifications**, **Forbidden** / **Not-found** pages.

## Internationalization (i18n)

The app is fully bilingual. The chosen language is kept in **localStorage**
(`ecotech.locale`, `ar` | `en`; the only key) and nowhere else — not in the URL,
cookies or sessionStorage. `I18nService` owns it: `init()` runs as an app
initializer (the stored language when valid, else Arabic; loaded and stored),
`use()` switches in place — same URL, no navigation, no reload, no history entry —
and keeps `<html lang dir>` in sync. A small script in `index.html` applies the
stored language and direction before first paint so there is no mis-directed
flash, and the layout mirrors for Arabic via CSS logical properties
(`start`/`end`, `ps`/`pe`).

Runtime catalogues are **generated**, not hand-edited. `scripts/sync-messages.mjs`
builds `public/i18n/<locale>.json` by deep-merging, in order:

1. `src/i18n/base/<locale>.json` — the vendored base catalogue.
2. `src/i18n/<locale>.extra.json` — app-wide overlay keys.
3. `src/i18n/<locale>/*.json` — per-feature fragments (merged alphabetically).

Edit the **sources** under `src/i18n/`, then run `npm run i18n:sync` (it also runs
automatically before `start` and `build`). Never edit `public/i18n/` by hand.

## Theming & design tokens

`src/styles.css` defines the design system as HSL CSS variables under `:root` and
`.dark`, mapped onto Tailwind utilities via `@theme inline`. Dark mode follows the
`.dark` class on `<html>` (toggled by `ThemeService`). The palette is a deep
teal-green primary with a solar-amber accent used sparingly, plus a neutral slate
scale tuned for dense data tables. Status, chart and sidebar colours all come from
the same token set so light, dark and any future white-labelling change in one
place.

Custom thin, theme-aware scrollbar utilities (`scroll-area`, `scroll-area-sidebar`)
are used by the shell's independently-scrolling panes.

The Ecotech brand colours from [ecotecheg.com](https://ecotecheg.com) live as
theme-independent constants (`--brand-petrol`, `--brand-sun`, `--brand-leaf`, …,
exposed as `bg-brand-*` / `text-brand-*`). The sign-in screens apply the
`.auth-theme` class, which re-points the shared token names at that palette, so
every primitive inside them follows without per-page overrides.

The company name is a **logotype**, not text: "Ecotech" set in Archivo Expanded
(a wide grotesque, weight 350, SIL OFL) with its own tracking and optical
spacing (`shared/ui/brand-wordmark/brand-wordmark.config.ts`).
`<app-brand-wordmark>` draws it as inline SVG from the font's outlines — no web
font — sized by cap height (`class="h-[0.5625rem]"`). Its two finishes are `text-brand-ink` and
`text-brand-champagne`. The sign-in scene's 3D wordmark uses the same letters
and the same layout function, so the two match letter for letter.

## Sign-in experience

Login, forgot-password and reset-password are children of one layout route
(`features/auth/shared/auth-layout.component`), so they share an interactive
Three.js scene — a shader-driven sun with a turning crown of rays and the
"Ecotech" logotype as extruded 3D type (deep petrol ink by day, champagne
white by night, each letter traced by a champagne hairline) — that stays
mounted while moving between them.
On wide screens the page is one layer: a sky filling the whole viewport, with
twinkling stars and meteors streaking across it at random, and on it the sun
(left, full height, pinned while the form scrolls) and the form — no panel
between them. On narrow screens the sun is a compact hero with its own sky.

- **Isolation** — everything 3D lives in `features/auth/shared/`:
  `solar-scene/` holds a framework-free `SolarScene` (renderer, camera fitting,
  OrbitControls, the `SunGrip`, disposal) wrapped by `SolarSceneComponent`
  (lifecycle, resize, visibility, reduced motion); `star-sky/` holds the flat
  `StarSky` (a seeded star field plus an instanced pool of meteors) wrapped by
  `StarSkyComponent`. Auth pages never touch either; tunables are in
  `solar-scene.config.ts` and `star-sky.config.ts`.
- **Interaction** — drag the sun to turn it any way, all the way round (mouse
  or touch). It stops spinning while held; on release a spring brings it home —
  a gentle release eases back, a flick completes the revolution — and it spins
  on. A drag anywhere else orbits the camera within limits and the wheel zooms;
  after a few idle seconds the camera drifts back to rest.
- **Themes** — the sky follows the app theme: daylight in light mode, a petrol
  night in dark. The CSS backdrops read the `--stage-*` tokens in `styles.css`;
  both scenes redraw in place from their `looks` entry for the theme.
- **Loading** — both canvases are `@defer (on idle)`, so three.js ships in a
  lazy chunk they share and never delays the form; the star sky is only mounted
  on wide screens. Without WebGL the CSS backdrops stand alone.
- **Cost** — pixel ratio capped (1.75 for the sun, 1.5 for the sky), rendering
  capped at 60 fps; the sun pauses off-screen. Under `prefers-reduced-motion`
  the sun renders only while dragged, returns home at once when let go, and the
  sky holds still with no meteors. Measured, the star sky adds no noticeable CPU
  or frame-time cost over the sun scene. Leaving the sign-in screens disposes
  every GPU resource and both WebGL contexts.
- **Logotype glyphs** — `brand-wordmark-glyphs.ts` (2D) and
  `wordmark-typeface.ts` (3D) hold just the letters the logotype and its
  descriptor need. Both are generated from one font file; the header of
  `scripts/build-wordmark-glyphs.mjs` says how to instance the weight and
  rerun it.

## Decorative 3D

A few quiet three.js pieces make the authenticated app feel finished. They
are presentation only — no business data, no business logic — and the app works
the same without them (no WebGL simply means no canvas).

| Where | Composition | What it is |
| --- | --- | --- |
| Dashboards (`/dashboard`, `/dashboard/executive`) | `centerpiece` | A hero band: three all-black solar panels floating in a staggered row, slowly following an imagined sun, with silk ribbons of light and motes |
| 404 / 403 | `sculpture` | The panel row on its own, above the code |
| Customer proposal link (`/p/:token`) | `ribbons` | Slow ribbons of light behind the proposal card |

Everything else — lists, forms, record pages, admin, table empty states — has
no 3D on purpose: those are work surfaces.

- **Where it lives** — `shared/decor/`: `DecorComponent` (`<app-decor composition="…">`,
  the only Angular part) wraps a framework-free `DecorStage`, which composes
  the pieces in `pieces/` (solar array, light ribbons, motes, sun glow) with
  their shaders in `shaders/`. Every tunable and both theme looks are in
  `decor.config.ts`. `HeroBannerComponent` (`shared/ui/hero-banner`) is the
  dashboards' band.
- **Usage** — always inside `@defer`, with the host sized by the page:
  `@defer (on idle) { <app-decor composition="ribbons" class="fixed inset-0 -z-10" /> }`.
  It never takes pointer events.
- **Budget** — at most 30 fps, paused whenever it is off-screen or the tab is
  hidden; pixel ratio capped (1.5, 1.25 on phones); no post-processing and no
  textures (the panels' cells are drawn in the shader). Measured on the
  dashboard: about +4 % CPU while the hero is visible, frame pacing unchanged.
- **Reduced motion** — one still frame, re-rendered only when the theme or size changes.
- **Teardown** — `disposeRenderer()` frees every GPU resource and the WebGL
  context, and also unhooks three.js's shared `DFG_LUT` lookup texture,
  which otherwise keeps every discarded renderer alive (the sign-in scene uses
  it too).

## Architecture & conventions

- **Angular 22 defaults** — standalone components, zoneless change detection and
  OnPush are assumed; don't restate them in decorators.
- **Dependency injection** via `inject()`; app-wide state lives in `core/` singletons.
- **Signals** for component and service state.
- **One class or interface per file**; domain models live in
  `features/<domain>/models/`.
- **Reference data** — every coded value shown to a user is resolved through the
  reference-data service's `label()`; never render raw codes.
- **HTTP** — `app.config.ts` registers the interceptors in a deliberate order: the
  error normaliser is outermost so the auth interceptor still sees a raw `401` and
  can refresh-and-retry before the error surfaces to the caller. Error bodies are
  read with `errorBodyOf()` (`core/api/error-body.ts`), which also parses the JSON
  envelope a text request (the realtime stream) receives as a string.
- **Navigation** — `core/navigation` declares the sidebar menu; an item appears
  only when the user holds its permission *and* a route for its path exists, so
  registering a feature route is what adds it to the sidebar. Links built in code
  (dashboard cards, exception drill-downs) go through `NavigationService.canOpen()`.
- **Access checks** — `AuthService.can()` / `canAny()` fail closed: no user, an
  unknown scope, or a write permission for a read-only profile (`isReadOnly`) all
  return false. Give every child route (`new`, `:id/edit`, …) its own
  `data.permission`; prefer server-computed `permissions` flags on detail
  responses for record-level buttons. When the backend `Permission` enum changes,
  update `core/auth/permission-code.ts` and regenerate
  `src/testing/role-permissions.ts` (role × permission fixtures for specs) with
  `node scripts/generate-role-fixtures.mjs` after building the backend;
  `core/navigation/role-access.spec.ts` holds the role × URL matrix.
- **Titles** — `TranslatedTitleStrategy` localises the browser tab title from each
  route's `title` key.

## Accessibility

Accessibility is a requirement, not a nice-to-have: pages target WCAG 2.1 AA in
both languages and both themes. Focus indicators are always visible on keyboard
interaction, the mobile navigation drawer is a focus-trapped modal dialog, and a
`reduced-motion` media query neutralises animations.

## Build & deployment

```bash
npm run build          # → dist/frontend (hashed, lazy-split bundles)
```

Serve `dist/frontend` as static files behind a web server, with `/api` routed to
the backend (same origin or reverse proxy). The build code-splits every feature
into its own lazy chunk, so initial load stays small.

## Git workflow

History is organised as a feature-branch workflow merged into `main` with
`--no-ff` merge commits, so each area of work is a visible branch in the graph:

```
main
 ├─ feat/i18n            localization resources + sync tooling
 ├─ feat/core-services   api, auth, navigation, notifications, storage, theme
 ├─ feat/layout          app shell + chrome
 ├─ feat/shared          UI primitives + record widgets
 ├─ feat/auth-and-home   auth, account, dashboard, notifications, errors
 ├─ feat/crm-records     customers, leads, intake, campaigns
 ├─ feat/sales-cycle     opportunities, pipeline, assessments, proposals, contracts, solar
 ├─ feat/delivery        projects, tasks, activities, handoffs, approvals, imports
 ├─ feat/analytics-admin analytics, reports, admin
 ├─ feat/app-bootstrap   bootstrap, routing, global styles, PWA assets
 └─ feat/navbar-scroll   independent sidebar / content scroll areas
```

For new work: branch off `main` (`feat/…`), commit focused changes, open a PR, and
merge with `--no-ff` to keep the branch topology in history.

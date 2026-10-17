# Software Requirements Specification — Frontend / Client Application

## Ecotech Solar Business Operations Platform

| Item | Value |
|---|---|
| **Document Version** | 1.0 (Final, consolidated) |
| **Document Type** | Software Requirements Specification — Frontend Subsystem |
| **System** | Ecotech — شركة إيكوتك للأعمال والتجارة — Integrated Solar Business Operations Platform |
| **Scope of this document** | Client application: screens, navigation, design system, bilingual/RTL behavior, accessibility, mobile/PWA, and every requirement whose home is the presentation layer |
| **Companion document** | `FINAL_SRS_BACKEND.md` — server-side data model, business rules, API and security requirements |
| **Status** | Final — consolidated from every specification and status document in this repository |
| **Date** | 2026-09-25 |

---

## 0. Document Provenance

This document consolidates, for frontend-scoped requirements, the following repository sources:

| Source | Role |
|---|---|
| `Solar_CRM_SRS_v2.0.md` | Master business/functional SRS. Requirement IDs are reused unchanged; §8 of this document maps each one to a screen/route. |
| `crm_srs.md` (v1.0) | Superseded by v2.0 (full traceability in v2.0 Appendix D); not separately re-derived. |
| `context.md` | Original product brief — source of the visual-identity brief, bilingual/RTL rules, mobile/PWA requirements, and accessibility requirements. |
| `FRONTEND.md` | Current target frontend architecture (Angular 22), UI-parity rules against the existing Next.js app, the full existing-feature port inventory, the SRS v2.0 gap list mapped to screens, and the route map. This document's own status column ("✅/🟡/⬜") is a **living tracker**, not part of this SRS — see §14. |
| `PROGRESS.md` | Engineering conventions (Angular guideline sheet) actually agreed and in force for the rewrite; used in §4. |
| `docs/uat/milestone-6-checklist.md`, `TEST_REPORT.md` | Evidence of what has already been built, verified in-browser, and accessibility-checked in the current production client. |

Where the target architecture (Angular 22) differs from the currently deployed production client (Next.js 15 App Router), both are described explicitly (§4.1) — the **screens, fields, filters, and behaviors required on each page are identical in both**; only the framework mechanics differ.

---

## 1. Introduction

### 1.1 Purpose

This SRS defines the requirements for the **client application**: every screen a user interacts with, the navigation and permission-gated menu structure, the shared design system, bilingual (Arabic/English) and RTL/LTR behavior, mobile and PWA behavior, and accessibility. It also states, explicitly, what the client is **not** responsible for: the client is never the security boundary (§9).

### 1.2 Core Business Principle

> Each department adds information to the same customer / site / opportunity / project record instead of creating a new record and restarting the process. The information travels through the workflow with the customer.

The client's job is to make this principle **visible and usable**: one Customer 360 view aggregating every department's contribution, one opportunity detail page showing the full team and journey, and completeness/timeline/notification affordances present on every relevant screen rather than isolated to one module.

### 1.3 Intended Audience

Frontend engineering team, UX/visual designers, accessibility reviewers, QA/UAT testers, and the backend team (as the API contract consumer's perspective).

### 1.4 Conventions

| Keyword | Meaning |
|---|---|
| **shall** | Mandatory requirement |
| **should** | Strongly recommended; deviation must be justified |
| **may** | Optional / configurable |

| Priority | Meaning |
|---|---|
| **P0** | Required for go-live of the phase it belongs to |
| **P1** | Required shortly after go-live |
| **P2** | Future / enhancement |

Requirement IDs (`AUTH-xx`, `LEAD-xx`, `PROP-xx`, …) are the same IDs defined in `Solar_CRM_SRS_v2.0.md` §9 and reused unmodified so frontend, backend and test artifacts cross-reference cleanly. Status legend used when referring to the living trackers: ✅ implemented · 🟡 partial · ⬜ not yet implemented.

### 1.5 Glossary

See `Solar_CRM_SRS_v2.0.md` §1.5 (Lead, Lead Bank, Self-Sourced/Bank-Assigned Lead, Customer, Contact, Site, Opportunity, Technical Intake, Handoff, Technical/Financial/Combined Proposal, Proposal Team, Collaborator, Completeness Score, Stage Gate, Next Action, Exception, Timeline vs Audit Log, kWp, BOM) — reused verbatim.

---

## 2. Business Objectives (frontend-relevant)

1. Give every role a workspace tailored to their actual daily work (§7), not one generic dashboard.
2. Make ownership, missing information, and pending actions always visible — never something the user has to go looking for (`NFR-007`).
3. Minimize data entry: reuse existing data everywhere it is already known; Quick Add on one screen; key information reachable in ≤2 clicks.
4. Present Arabic as a first-class experience, not a translated afterthought — real Arabic copy, correct RTL layout, correct business terminology, never a raw internal enum value shown to a user.
5. Work correctly on desktop, laptop, tablet, Android and iPhone, installable as a PWA, so field sales/technical staff can use it away from a desk.
6. Be accessible (keyboard, screen reader, contrast, touch targets) by construction, not as an afterthought pass.
7. Look and behave identically regardless of which frontend framework renders it — the currently-shipped Next.js client is the visual reference; the in-progress Angular rewrite must be indistinguishable to a user (§4.2).

---

## 3. Scope

### 3.1 In scope for the frontend

Application shell (sidebar, top bar, mobile drawer, notification bell, theme toggle, language switcher, user menu, skip link, breadcrumbs, quick-create menu, global search) · every screen enumerated in §8 · client-side form UX and validation feedback (mirroring, never replacing, server-side validation) · permission-gated navigation (an affordance only, §9) · design tokens, typography, iconography, component primitives, page anatomy · bilingual/RTL rendering rules · mobile responsive layout and PWA installability, offline-tolerant drafts where specified · accessibility (keyboard nav, ARIA, contrast, focus management) · client-side performance (bundle size, loading/empty/error states) · role workspaces · in-app notification presentation.

### 3.2 Out of scope for the frontend (owned by the backend SRS)

Authoritative business-rule enforcement, record-level security, data persistence, duplicate/completeness computation, automation, and anything whose absence would compromise data correctness or security rather than merely usability — see `FINAL_SRS_BACKEND.md`.

### 3.3 Future scope (P2)

Interactive digital solar proposals, proposal engagement analytics (sent/opened/viewed), a customer self-service portal, AI-assisted drafting surfaces (see `FINAL_SRS_BACKEND.md` §16) — none required for any go-live phase defined in §13.

---

## 4. Technology and Architecture Requirements

### 4.1 Two client states

| | Current production client | Target architecture (active rewrite) |
|---|---|---|
| Framework | Next.js 15, App Router | Angular 22, standalone components only, no NgModules |
| Change detection | React reconciliation | Zoneless (`provideZonelessChangeDetection`) |
| State | React state/server components | Signals (`signal`, `computed`, `effect`, `resource`/`rxResource`) for component/service state; RxJS reserved for HTTP streams |
| Forms | Native form + server actions | Typed reactive forms or Signal Forms (per the product owner's guideline sheet, §4.3) |
| Styling | Tailwind CSS, `globals.css` design tokens | Tailwind CSS v4 loading the **identical** token set |
| Status | Live in production; Milestones 1–6 (first slice) shipped, evidenced in `TEST_REPORT.md` and `docs/uat/milestone-6-checklist.md` | Foundation + first feature slices (customers) shipped as of 2026-09-24 (`PROGRESS.md`); in progress |

Both clients shall render the **same** screens (§8) with the **same** fields, filters, and permission behavior — this document does not require a specific framework, but §4.2–§4.4 state target-architecture-specific conventions that apply to the in-progress Angular rewrite.

### 4.2 UI parity with the current app (hard requirement)

The Angular rewrite **shall look identical** to the current Next.js application. This is not a soft preference — it is a stated hard requirement of the rewrite (`FRONTEND.md` §2), verified by side-by-side comparison:

1. **Design tokens**: the same CSS variable set (every HSL variable for light and dark, badge tint foregrounds, chart palette, radius scale) and the same Tailwind config values (colors, `2xs` font size, radius scale, fonts) — copied, not reinterpreted.
2. **Fonts**: Inter (Latin, `--font-sans`), Cairo (Arabic, `--font-arabic`, body line-height 1.75), JetBrains Mono (`--font-mono`).
3. **Shell**: identical structure and class names to the reference implementation.
   - Sidebar: `w-64 bg-sidebar`, a `Sun` logo tile in `bg-sidebar-accent`, section headings in small uppercase tracked type, active item highlighted at 20% accent opacity.
   - Sticky top bar, `h-14`, backdrop-blur background.
   - Mobile drawer, `w-72`, with a 50%-opacity black scrim and `role="dialog"` (with a real focus trap — a `<div role="dialog">`, not `role="dialog"` on an `<aside>`, which automated accessibility checks reject).
   - Right-hand cluster: notification bell with a destructive-tone unread-count badge, theme toggle (Light/Dark/System with a check mark on the active choice), language switcher showing the *other* language rendered in its own script, user menu (initial avatar, name, job title, e-mail forced LTR, a red Sign-out item).
4. **Primitives**: Button variants (`default/destructive/outline/secondary/ghost/link`) and sizes (`default/sm/lg/icon`); Badge tones (`neutral/info/success/warning/danger/outline`); Card family; Alert variants; Table (bordered rounded wrapper, `bg-muted/50` header, `h-11` uppercase head cells, `bg-muted/40` row hover, a distinct empty state with generous padding); Input/Select at `h-10` with `aria-invalid` driving a destructive border. Every primitive reproduces the exact class strings of the reference implementation, not a visually-similar approximation.
5. **Page anatomy**:
   - Header block: `h1` at `text-2xl font-semibold tracking-tight`, a muted subtitle, the primary action placed at the layout's logical end (never hardcoded "right").
   - A list toolbar: search with an icon, a "Search" button, a "Clear" action that appears only when filters are active, filters laid out in a responsive grid (2 columns on small screens, 4 on large) that submit on change, plus checkbox quick filters.
   - Then the data table, then pagination showing "Showing x–y of z", a page-number window with an ellipsis for long ranges, and chevrons that swap direction under RTL.
6. **Detail pages**: the record number (muted, tabular figures) shown above the title; action buttons; a `grid gap-6` layout with the main details card spanning two of three columns and an assignment card beside it; below that, section headings (`h2`, `text-lg font-semibold`) each followed by their own table.
7. **Login page**: centered, max-width-medium layout; a primary `Sun` tile; title and subtitle; notice alerts (see §8.1); a card containing the form; the company name in the footer; a theme toggle pinned to the top logical-end corner.
8. **Pipeline board**: horizontally scrolling columns (`w-72`, rounded, bordered, muted background); cards show the record number, name, customer, badges, value, and an SLA-warning icon when relevant.
9. **Bilingual rules** (binding on every screen):
   - Logical CSS properties only (`ps`/`pe`/`ms`/`me`/`start`/`end`) — never physical `left`/`right`.
   - Numbers, phone numbers, e-mail addresses and record numbers are forced `dir="ltr"` inline even inside an Arabic (RTL) page, using a dedicated utility class, so a phone number never visually reverses.
   - Dates are Gregorian, rendered in the `Africa/Cairo` timezone.
   - Currency is formatted as EGP.
   - No raw internal enum/status value is ever shown to a user — every stored code resolves through the i18n catalogue to an Arabic or English label.

### 4.3 Target architecture conventions (Angular 22)

| Concern | Requirement |
|---|---|
| Components | Standalone only; per the product owner's Angular guideline sheet for this project, `standalone: true` and `changeDetection: OnPush` are **not** written explicitly (both are v22 defaults given the zoneless configuration) — this is a deliberate, documented deviation from the generic Angular-22-best-practice checklist and should not be "corrected" back. |
| Services | Singleton services use `@Service()` (project convention, not the framework default `@Injectable({ providedIn: 'root' })`); `inject()` is used everywhere instead of constructor injection. |
| State | Signals (`signal`, `computed`, `linkedSignal`, `rxResource`) for all component and service state; `input()`/`input.required()`/`output()`/`model()` for component APIs; host bindings live in the `host: {}` metadata block, never `@HostBinding`; `ngClass`/`ngStyle`/`CommonModule` are not used — native control flow and class bindings replace them. |
| Forms | **Signal Forms** (`@angular/forms/signals`) per the product owner's guideline sheet — a deliberate deviation from typed reactive forms, applied consistently across the rewrite. |
| Templates | Built-in control flow (`@if`, `@for` with `track`, `@switch`, `@defer`). |
| Routing | Lazy-loaded feature routes (`loadComponent`/`loadChildren`), functional guards (`CanActivateFn`), `withComponentInputBinding()` so route params arrive as component inputs, `withViewTransitions()`. Every route declares its required permission as route data and is protected by a functional permission guard — understood as **UX only**; the API independently re-checks (§9). A sidebar item shall appear only when its target route actually exists in the router configuration — no menu entry may lead nowhere. |
| HTTP | `provideHttpClient(withFetch(), withInterceptors([...]))`; functional interceptors for the auth token, refresh-on-401 (a single shared refresh across a burst of concurrent 401s, not one refresh per failed request), locale header, and error-envelope normalization. |
| Styling | Tailwind CSS v4 through PostCSS, loading the same token set as the reference app (`@theme inline` over the identical CSS variables, per the v4-appropriate mechanism — the deliberate deviation from `@config` recorded in `FRONTEND.md`'s implementation log). |
| Icons | The same icon set as the reference app (`lucide`), rendered through a small shared icon component. |
| Overlays / drag-and-drop | Angular CDK (Overlay/Menu/Dialog/DragDrop/A11y). |
| i18n | Runtime Arabic/English catalogues — the shared `messages/ar.json` / `messages/en.json` remain the single source of truth (extended, not forked); `dir`/`lang` set on `<html>`; locale-prefixed URLs (`/ar/...`, `/en/...`) exactly matching the reference app's routing convention. |
| Structure | `core/` (singletons: auth, i18n, theme, api, layout, reference data, navigation) · `shared/` (UI kit, domain-specific shared components, pipes) · `features/<domain>/` (lazy-loaded pages), one feature folder per domain listed in §8. |
| Security | JWT access token held in memory, refresh token persisted (rotation handled by the backend); **the UI hides what a user cannot do, but the backend is the security boundary** (§9, `RBAC-05`). |
| Accessibility | A skip link, a visible focus ring on every interactive element, `aria-*` attributes on every control, `role="alert"` for error regions, keyboard-navigable menus (via CDK), RTL-aware icon mirroring. |
| Images | `NgOptimizedImage` for static images. |

### 4.4 Folder layout (target)

```text
frontend/src/app
├── core
│   ├── api/            ApiService, typed endpoint helpers, error model
│   ├── auth/            AuthService (signals), guards, interceptors, permission helpers
│   ├── i18n/            I18nService, TranslatePipe, locale guard, direction handling
│   ├── theme/            ThemeService (light / dark / system, persisted)
│   ├── layout/           AppShell, Sidebar, TopBar, NotificationBell, UserMenu, LocaleSwitcher, ThemeToggle, GlobalSearch
│   ├── reference/        ReferenceDataService (cached lookups: governorates, stages, sources, …)
│   └── navigation/       Navigation model (data, permission-gated, one source for sidebar + command palette)
├── shared
│   ├── ui/               button, badge, card, alert, table, input, select, textarea, label, field, dialog, dropdown, icon, pagination, list-toolbar, page-header, detail-list, empty-state, spinner, tabs, stat-card, progress
│   ├── crm/               completeness-panel, timeline, status-badge, owner-chip, stage-badge, health-badge, gps-capture, dynamic-form, entity-picker, record-link
│   └── pipes/             date/datetime/number/currency/phone/relative-time/bilingual-name
└── features
    ├── auth/              login
    ├── dashboard/         personal + executive + role workspaces
    ├── leads/             lead bank, my leads, quick add, detail, convert wizard, close, distribute
    ├── customers/         list, form, Customer 360 (contacts, sites, opportunities, timeline, documents, ownership)
    ├── opportunities/     list, form, detail (team, readiness, gates, intake, handoff, proposals, negotiation), pipeline board
    ├── activities/        calls, meetings, visits, tasks
    ├── solar/             assessments, technical intake
    ├── handoffs/           inbox + detail
    ├── proposals/          technical / financial / combined proposals, register, revision requests
    ├── approvals/          approval inbox
    ├── contracts/          contracts
    ├── projects/           projects, phases, milestones, commissioning, handover
    ├── notifications/      notification center
    ├── exceptions/         exception / attention center + data quality
    ├── reports/             reporting center + export
    ├── search/              global search results
    └── admin/               users, roles & permissions, teams, reference data / solution catalog, audit log, automation monitor, imports
```

---

## 5. Stakeholders

See `FINAL_SRS_BACKEND.md` §4 for the full role/responsibility table (CEO/Management, Sales Manager, Sales Representative, Marketing, PM, Technical Lead, Technical/Solar Engineer, Finance/CFO, Operations, System Administrator) — reused unmodified. §7 below states what each role's **workspace** contains on the client.

---

## 6. Product Identity and Visual Design

From `context.md` §5:

- The application shall feel trustworthy, modern, technical, clean, fast, business-oriented, suitable for daily use, and easy for non-technical employees. It shall avoid excessive animations, gradients, decorative effects, and dashboard clutter.
- The application shell includes: a collapsible sidebar, a top navigation bar, global search, a notifications center, a quick-create menu, a language switcher, a user profile menu, breadcrumbs, page-level actions, saved filters, and recently-viewed records.
- Arabic shall be fully implemented with real, professionally written Arabic copy — never machine-generated placeholder text. Requirements: full RTL behavior in Arabic and full LTR in English; translated navigation, labels, validation messages, statuses, notifications, reports and e-mails; localized dates and numbers; no untranslated internal enum values anywhere; a per-user stored language preference.
- Consistent Arabic business terminology is mandatory, for example: العملاء (Customers) · جهات الاتصال (Contacts) · الفرص البيعية (Opportunities) · الأنشطة (Activities) · المكالمات (Calls) · الزيارات (Visits) · المعاينات الفنية (Technical Assessments) · المتابعات (Follow-ups) · عروض الأسعار (Quotations) · العقود (Contracts) · المشروعات (Projects) · التقارير (Reports) · سجل العمليات (Audit Log).

---

## 7. Role Workspaces (§11 of the master SRS, reused)

`/dashboard` (and the equivalent authenticated landing route) shall render a workspace tailored to the signed-in user's primary role, not one undifferentiated dashboard:

### 7.1 Sales Representative
My Leads (New / Assigned / Self-sourced / Follow-ups due / Nurture) · Quick Add Lead (mobile-first) · lead qualification and closure-with-reason · Convert to Customer wizard · Customer Enrichment tasks + completeness panel · My Customers (Customer 360) · My Opportunities (kanban/list) with enforced next action · New Opportunity + Technical Intake Form · Sales Readiness Checklist per opportunity · meetings, site visits, check-in/out (mobile) · project data checklist + Submit Handoff · released-proposals inbox → Send/Present log → Proposal Register · Revision Request and Negotiation events · add-collaborator (PM) · My Tasks, notifications, personal dashboard.

### 7.2 Sales Manager
Lead Bank + distribution (instant/batch/preview) · team capacity view · SLA/escalations · ownership-conflict and transfer approvals · discount approvals up to threshold · team pipeline & health · closed-lead review · team exceptions · sales dashboard.

### 7.3 Project Manager
Handoff inbox (Accept/Return/Clarify) · "Collaborating on" opportunities · engineer assignment · TP-received queue · Financial Proposal workspace · Combined Proposal assembly & submit for approval · revision-request queue · proposal register view · projects list, plan, milestones, commissioning, handover · operational dashboard.

### 7.4 Technical Lead
Engineer workload & assignment · TP review/approval queue · technical-revision queue · intake-data verification.

### 7.5 Technical / Solar Engineer
My assignments (assessments, designs, TPs) · site visits & check-in · technical intake (verify/correct) · assessment & system design with BOM · TP drafting & versioning · design-document uploads.

### 7.6 Finance / CFO
Approval inbox (discount, margin, payment terms, contract) · FP validation queue · pricing-rules & margin-floor configuration · contracts pending financial review · finance dashboard · cost/margin visibility.

### 7.7 CEO / Management
Executive dashboard · Exception/Attention Center · high-level approvals · conversion FYIs (new customers) · deal-health overview · duplicate/ownership final decisions · marketing ROI.

### 7.8 Marketing
Campaigns · lead import & integrations · Lead Bank (view) · lead-quality feedback · attribution & marketing dashboard.

### 7.9 Operations
Project task board, procurement, installation progress, commissioning & handover records · site-visit schedule.

### 7.10 System Administrator
Users, roles, permissions, teams, territories, capacity · Solution catalog & intake forms · completeness rules · stage gates · SLA, approval matrix, routing rules · templates · notification rules · automation monitor & retry · imports & duplicate review queue · audit viewer.

---

## 8. Functional Requirements by Screen

This section is organized as a screen-by-screen inventory. Each row states the requirement ID(s) it fulfils (defined in `Solar_CRM_SRS_v2.0.md` §9 and restated fully in `FINAL_SRS_BACKEND.md` §9), the route, and the concrete UI behavior expected — combining (a) everything already shipped and verified in the current production client, which the rewrite must not regress, and (b) everything the v2.0 SRS still requires that has no client screen yet.

### 8.1 Authentication (`AUTH`)

| Route | Requirement |
|---|---|
| `/login` | E-mail/password login form. Reason-specific notice alerts for: signed out, session expired, account inactive, no profile found, return-to redirect after re-authentication. A theme toggle available before sign-in. |
| user menu → `/account/password` | Change password, including a forced flow when the account is flagged `mustChangePassword`; a self-service reset request entry point. |
| (interceptor-driven) | A session-expiry response redirects to `/login` with the correct notice; a deactivated-account response is blocked with its own notice — never a generic error. |

### 8.2 Application Shell (`E2`)

All authenticated routes render inside a shared shell:

- Permission-filtered sidebar, organized into sections (Overview / Sales / Solar workflow / Analytics / Operations), where a section or item is present only if the signed-in user holds the permission it requires **and** the target route exists.
- Mobile drawer (a real dialog with a focus trap, not a sidebar toggled by CSS alone).
- Sticky top bar.
- Environment badge outside production.
- Notification bell: unread count, a recent-items list, mark-all-read on open, deep links into the referenced record.
- Theme toggle: light/dark/system, with no flash of the wrong theme on page load (resolved before first paint) and a correctly synced `theme-color` meta tag.
- Locale switcher that preserves the current path and query string when switching language.
- User menu (avatar, name, job title, e-mail forced LTR, sign-out).
- Skip link for keyboard/screen-reader users.

### 8.3 Dashboard (`DASH`, `E4`, `E5`)

| Route | Requirement |
|---|---|
| `/dashboard` | Welcome + profile summary (roles, team, manager, last sign-in). KPI cards: new customers, leads created, proposals sent, win rate, pipeline value, weighted pipeline, contract value, pipeline capacity — each computed from real data, never hardcoded. Analytics filters: date range, rep, team, governorate, category, service, source, stage. Opportunities-by-stage breakdown. Opportunities requiring action (SLA-driven). Performance by governorate/service. Data-quality summary. Rep leaderboard. Financial values hidden from users without the financial-view permission (`RBAC-03`). |
| `/dashboard/executive` | Company-wide KPIs, top reps, data-quality summary, a link into the reports center. Gated by the executive-dashboard permission; a user without it that navigates here directly sees a forbidden boundary with **no** executive figures leaked into the response body or the page. |
| role workspaces | Per §7 — PM/Technical Lead/Engineer/Finance workspaces render their own widget set on the same route family. |

### 8.4 Customers, Contacts, Sites (`CUST`, `CONT`, `SITE`, `E6`, `E7`)

| Route | Requirement |
|---|---|
| `/customers` | List with search, status/category/governorate filters, "mine"/"overdue" quick-filter toggles, pagination, columns for owner and open-opportunity count, a visual highlight for overdue follow-up. |
| `/customers/new`, `/customers/:id/edit` | Sectioned form: identity, classification, location, contact, registration (CR/tax), assignment, follow-up, notes. A duplicate-match warning panel (`DUP-04`) with per-field match scores and the four resolution actions (Use Existing / Merge / Keep Separate / Review Later) is shown inline before the record is created. |
| `/customers/:id` | Customer 360 (`CUST-03`): header (owner, status, completeness, tags); tabs for contacts, sites, leads, opportunities, activities (calls/meetings/visits/tasks), assessments, proposals, contracts, projects, documents, ownership history, and the unified customer timeline. A "merged" notice and read-only redirect for a record that lost a merge. |
| `/customers/:id/contacts/new` | Nested contact create: name, job title, department, mobile, alternate phone, e-mail, preferred channel, decision role, influence, primary flag, WhatsApp flag, notes. |
| `/customers/:id/sites/new`, `/customers/:id/sites/:siteId/edit` | Site CRUD (`SITE-01..05`): type, address, governorate, GPS map pin, available area, roof type/condition, orientation, shading, utility provider, photos. |

### 8.5 Leads (`LEAD`, `CONV`, `E8`)

| Route | Requirement |
|---|---|
| `/leads` | Central Lead Bank list: Lead ID, name, company, phone, source, **intake mode** badge, campaign, priority, customer type, governorate, sector, assigned rep, status, last activity, next action, follow-up deadline, **SLA-status badge** (on track / due soon / breached), lead age, completeness %. Filters, saved views, bulk select, bulk assign, permission-gated export. |
| `/leads/quick-add` | A single-screen, mobile-friendly Quick Add form: name, phone, company, governorate/location, source, requirement, notes; an optional inline "log this call now" (outcome, next action). Duplicate + ownership results are shown **before** the record can be saved, not after. |
| `/leads/new`, `/leads/:id/edit` | Full lead form: identity, contact, location, requirement, source, assignment, notes. |
| `/leads/mine` | Tabs: New (unopened), Assigned to me, Self-sourced, Follow-ups due, Nurture — sorted by SLA urgency, with an "opened" indicator on first view. |
| `/leads/:id` | Detail with contact-attempt logging, qualification fields, a close panel (reason + comment, from the closure taxonomy), a reopen action for authorized users, and a completeness panel. |
| `/leads/:id/convert` | Convert wizard (`CONV-01..11`): duplicate check → create new customer / link existing → primary contact → optional site → optional first opportunity (which opens the Technical Intake Form). An ownership-conflict dialog interrupts the wizard when the target customer is already owned. On success, the lead becomes read-only in the UI. |
| `/leads/distribute` | Manager distribution screen: manual assignment, instant rule-based distribution, and a **batch preview** showing the proposed per-rep allocation before it is confirmed. |

### 8.6 Opportunities and Pipeline (`OPP`, `E9`, `E10`)

| Route | Requirement |
|---|---|
| `/opportunities` | List with filters and a collaborator ("collaborating on me") view. |
| `/opportunities/new`, `/opportunities/:id/edit` | Form: identity, customer, site, solution type, commercial fields (value, kWp, storage kWh), assignment, next step, notes. |
| `/opportunities/:id` | Detail: workflow-status summary (assessment/proposal/contract/handoff); a stage-transition panel offering only the configured allowed next stages, with the outcome/reason/contract-value fields the target stage requires; stage history with time-in-stage; an **Opportunity Team** panel (owner, collaborators, PM, engineer, technical lead, financial preparer, approvers) with add/remove-collaborator actions; a **Sales Readiness Checklist** tab; a next-action field that blocks save when required and empty, with a visible overdue highlight; a Deal Health badge with its contributing reasons (never shown without them); a Customer Journey milestone tracker; a Proposal Register section (see §8.11); a negotiation/revision-request tab. |
| `/pipeline` | Kanban board by stage, drag-and-drop subject to server-validated gates, per-column count and value, an SLA-breach flag on at-risk cards. |

### 8.7 Technical Intake (`TIN`)

| Route | Requirement |
|---|---|
| `/opportunities/:id/intake` | A **dynamic** form driven by the opportunity's solution type (Appendix B of the backend SRS): sections shown/required per type, each field showing its data-origin tag (customer-provided / sales-observed / engineer-verified) and supporting partial save. An engineer-facing "verify" mode that preserves the original value in a visible history rather than silently overwriting it. |

### 8.8 Activities: Calls, Meetings, Site Visits, Tasks (`ACT`, `MEET`, `VISIT`, `TASK`, `E11`–`E14`)

| Route | Requirement |
|---|---|
| `/calls`, `/calls/new`, `/calls/:id`, `/calls/:id/edit` | Direction, time, duration, phone, purpose, outcome, summary; a follow-up action that creates a linked task. |
| `/meetings`, `/meetings/new`, `/meetings/:id`, `/meetings/:id/edit` | Mode, time, location/URL, agenda, internal/contact/external attendees; complete action (minutes, decisions, action items, follow-up); cancel with reason; a **GPS arrival/departure panel** showing distance from the customer, gated by `meetings.view_locations` — a user without that permission sees only that arrival/departure occurred, never coordinates or distance. |
| `/visits`, `/visits/new`, `/visits/:id`, `/visits/:id/edit` | Type, planned date, planned coordinates/address, purpose; **GPS check-in/check-out** capture with an accuracy display, a manual-reason field surfaced when GPS is unavailable, distance-from-planned-location; outcome/next-action/follow-up; cancel. Mobile camera photo capture. |
| `/tasks`, `/tasks/new`, `/tasks/:id`, `/tasks/:id/edit` | Views: mine / team / overdue / today / upcoming / all; start / complete (with notes) / cancel (with reason); priority. |

### 8.9 Project Data Collection and Handoff (`PDC`, `HAND`)

| Route | Requirement |
|---|---|
| opportunity detail | A project-data checklist widget showing completeness % and the exact named missing items (`PDC-02`), each with a "request from customer" action that creates a tracked task. |
| `/opportunities/:id/handoff` | The auto-assembled handoff package view with a ✓/✗ per required item; a blocked-submission state naming exactly what's missing, with an override path (reason required) restricted to authorized roles; a submit action that snapshots the package. |
| `/handoffs`, `/handoffs/:id` | PM inbox: Accept (with engineer + tech-lead assignment inline), Return for Information (reason + missing-items list, both mandatory), Request Clarification (a threaded conversation), resubmission-count display. |

### 8.10 Solar Assessments (`TECH`, `E15`)

| Route | Requirement |
|---|---|
| `/assessments`, `/assessments/new`, `/assessments/:id`, `/assessments/:id/versions/new`, `/assessments/:id/versions/:versionId` | Versioned assessment forms (consumption, electrical, site, design, estimates); a month-by-month utility-bill table; submit-for-review action; a decision screen (approve / reject / request info) restricted to the authorized approver role, distinct from the reviewing engineer; an approved version renders read-only (no edit affordance at all, not merely a disabled button); a "request a proposal" action once approved. |

### 8.11 Proposals: Technical, Financial, Combined, Register (`TPROP`, `FPROP`, `PROP`, `PRES`, `NEG`, `E16`)

| Route | Requirement |
|---|---|
| `/proposals/technical/:id` | Technical Proposal draft/versioning UI, restricted to the assigned engineer/tech lead — a Sales-role user sees a read-only view with a "not permitted to edit" state, never a disabled form that implies they almost could. Submit → Tech Lead approve/return; an approved version renders locked. |
| `/proposals/financial/:id` | Financial Proposal UI: cost lines (from BOM), price, discount (+ mandatory reason once non-zero), margin (hidden entirely — not merely blurred — from roles without cost/margin visibility), VAT, payment milestones, validity, financing options. A threshold-triggered "requires approval" banner. |
| `/proposals/combined/:id` | Combined Proposal assembly (PM only): pick one approved TP + one approved FP version; submit for approval; **Release to Sales** action once approved. |
| opportunity detail → Proposal Register | Every customer-facing version listed with version no., date, channel, presenter, Technical Author, Financial Preparer, approver, price, kWp, discount, validity, customer response, status. A "log send/present" action (date, channel, recipients, presenter) that locks the version once submitted; an expired-version flag; a "mark Final" action enforced as exactly-one-per-opportunity. |
| `/proposals/combined/compare` | Side-by-side version comparison: price, kWp, equipment, discount, margin (permissioned), payment terms, validity, scope. |
| opportunity detail | Revision Request action (type: financial / technical / both), tracked visibly to closure (resulting version or rejection reason) rather than disappearing once submitted. Structured Negotiation Event log (type, original/requested value, competitor, linked CP version, approval-required flag), with internal notes visibly separated from customer-visible notes so a user cannot accidentally paste an internal note into a customer-facing field. |
| opportunity header | The responsible **Technical Author** and **Financial Preparer** of the latest released/final proposal are always visible on the opportunity header, not buried in a tab. |

### 8.12 Approvals, Contracts, Projects, Documents (`APPR`, `CONTR`, `PROJ`, `DOC`, `E17`)

| Route | Requirement |
|---|---|
| `/approvals` | Inbox scoped to discount, margin, payment terms, CP release, ownership transfer/collaboration, and gate override requests; approve / reject / return with a mandatory comment on reject/return; SLA/reminder display; delegation-aware (shows requests delegated to the current user). |
| `/contracts`, `/contracts/:id` | Contract detail generated from the Final CP: value, payment milestones, signatories, required-documents checklist with received/outstanding state, signature status per party. |
| `/projects`, `/projects/:id` | Auto-created project view showing all inherited data (customer, site, technical, commercial, Proposal Team) with **no re-entry form** for any of it; phases, milestones, commissioning record, handover record with customer-acceptance capture. |
| `<app-documents-panel>` (reused on every entity) | Upload with a required category selection, a version history list, and download only via a short-lived signed link — never a raw storage URL anywhere in the DOM or a screenshot. |

### 8.13 Timelines, Journey, Notifications (`TIME`, `JOUR`, `NOTIF`)

| Route | Requirement |
|---|---|
| `<app-timeline>` (customer and opportunity detail) | Human-readable, filterable (event type / user / date / opportunity) business history — visually and structurally distinct from any raw audit-log view. |
| opportunity detail | Milestone journey tracker: current, completed and remaining milestones, missing requirements, delays, responsible employee, next action, due date. |
| `/notifications` | Full notification center with filters, mark-read / mark-all-read; the bell in the shell deep-links here and into individual records. |

### 8.14 Management, Data Quality, Reports, Search, Admin (`DASH`, `DQ`, `EXC`, `RPT`, `AUD`, `MKT`)

| Route | Requirement |
|---|---|
| `/exceptions` | Exception/Attention Center: counts with drill-down into the offending record, scoped by the viewer's role (a manager sees team exceptions, a rep sees only their own). |
| `/exceptions?tab=data-quality` | Data-quality dashboard: duplicate clusters, unassigned leads, ownership conflicts, missing phone/governorate, incomplete customers/opportunities, opportunities without next action, stagnant opportunities, overdue activities — every row links into the offending record. |
| `/reports`, `/reports/:code` | Reporting center listing the 28-report catalogue (`FINAL_SRS_BACKEND.md` §12.1) with the standard filter set (date, user, team, governorate, city, sector, category, service, stage, source, status where relevant) and CSV/XLSX/PDF export, gated by the export permission. A large export is queued as a background job and the user is notified when it is ready — the UI never blocks on it synchronously. |
| top bar + `/search` | Global search (command palette, `Ctrl`/`⌘ K`) across customer name, contact name, phone numbers, e-mail, customer ID, lead ID, opportunity ID, proposal number, tax/commercial registration number, address, and notes where appropriate. Phone-number input is normalized before matching. Advanced saved-filter examples the UI shall support out of the box include: "my overdue opportunities," "industrial customers in Cairo," "opportunities waiting for technical assessment," "proposals expiring this week," "customers without activity for 30 days," "opportunities above a selected value," "solar pumping opportunities," "visits completed today." |
| `/admin/users`, `/admin/users/:id` | User CRUD; role/team/manager assignment; territory and sector-specialization assignment; lead-capacity and availability configuration; deactivate with a mandatory reassignment prompt for open work; approval delegation (date range). |
| `/admin/roles` | Role and permission-matrix editor, with scope (own/team/all) editable per grant. |
| `/admin/reference` | Solution catalog / intake-form-definition admin; campaign master data; every other master-data list in §10 of the backend SRS. |
| `/admin/audit` | Audit-log viewer with filters and a before/after diff view, visible only to authorized roles. |
| `/admin/automation` | Automation monitor: failed runs with their error, and a retry action. |
| `/admin/imports` | CSV upload for leads/customers with a validation-preview result (valid/invalid/duplicate row counts) before any commit. |
| `/integrations` | Provider readiness list (email, WhatsApp, maps, monitoring): provider name, type, enabled flag, status, and secret **names only** — no credential value ever rendered in the DOM, logs, or a screenshot. |

---

## 9. Security Boundary (frontend responsibility statement)

The client application **shall** hide navigation items, buttons, and form controls the current user is not permitted to use — this is a real, valuable usability affordance. The client application **shall not** be relied upon as the enforcement mechanism for any authorization decision (`RBAC-05`): every permission check the UI performs is a convenience duplicate of a check the backend independently re-performs on the actual request. Consequently:

- A route/permission guard failing open (e.g., due to a stale cached permission list) is a UX defect, not a security incident, **provided** the corresponding API call is independently rejected — this must be verified, not assumed.
- The client shall never construct a request whose authorization it is trusting the server to skip (e.g., never pass a client-computed "isAdmin" flag that the server trusts instead of re-deriving from the session).
- Sensitive field values (cost, margin, secret names) that the current user lacks permission to see shall not merely be styled as hidden — they shall not be present in the API response the client received in the first place (this is a backend-SRS requirement, `RBAC-03`; the frontend requirement is to never attempt to "unhide" such a field through a debug toggle or dev-tool affordance).

---

## 10. Mobile and PWA Requirements (`NFR-009`, from `context.md` §22)

The application shall work correctly on desktop, laptop, tablet, Android and iPhone, and shall be installable as a Progressive Web App so field employees can add it to their home screen.

Mobile field users shall be able to, from a phone: add a lead, add a customer, add contacts, record a call, record a meeting, start and complete a visit, capture GPS location, capture and upload photographs, upload electricity bills and other PDF files, record voice-to-text notes where the platform supports it, update an opportunity, create a solar-assessment draft, schedule a follow-up, view assigned customers and tasks, click-to-call, open WhatsApp, and open a customer's location in a maps application.

Mobile forms shall be optimized for: large touch targets, minimal typing, progressive disclosure, camera-driven uploads, a clear save-status indicator, draft preservation across navigation, and slow/unreliable connections. Where practical, calls, visits, notes, and assessment drafts support offline drafting with safe synchronization when connectivity returns — **the UI shall never claim a successful server sync before the server has actually confirmed it.**

PWA acceptance checks (from `docs/uat/milestone-6-checklist.md`): the manifest declares `display=standalone` and a sensible authenticated `start_url`; the manifest and any robots directive mark the app as non-indexable (`noindex`) since it is private; pinch-zoom is never disabled; a mobile viewport (390px width) renders the Arabic login RTL correctly before any interaction, and the sidebar drawer opens/closes correctly with forms remaining usable at that width.

---

## 11. Accessibility Requirements (`context.md` §36, `NFR` conventions)

The client shall implement, by construction, not as a late audit pass:

- Full keyboard navigation, with a visible focus indicator on every interactive element.
- Accessible labels on every form control, with `aria-invalid` + `aria-describedby` wiring validation errors to their field.
- Sufficient color contrast in both light and dark themes — text ≥4.5:1, non-text (icons, badge borders) ≥3:1, verified against **rendered pixels**, not just the design-token values on paper (the current production client found and fixed a real 2.14:1 chart-series defect this way).
- Screen-reader-compatible forms with semantic headings and accessible tables.
- Charts accompanied by a summary or an underlying data table, never conveyed by color alone.
- Touch-friendly controls on mobile.
- `role="alert"` reserved for real, non-empty error content — a router's own empty route-announcer region must never be mistakenly scored as a form error by an automated check (a real defect found in this codebase's own test harness).
- Every shipped page is checked with an automated accessibility tool (axe-core) in the browser in both languages and both themes as part of its verification, not merely type-checked and built.

---

## 12. Non-Functional Requirements (frontend-relevant subset)

| ID | Requirement |
|---|---|
| NFR-002 Performance | Common screens render in P95 < 2.5 s. Client bundles are kept lean via lazy-loaded feature routes — the current rewrite's foundation + customers slice shipped at a 340 kB initial bundle (91 kB gzip), which is the kind of budget subsequent feature slices should respect, not silently regress. |
| NFR-007 Usability | Minimal data entry; reuse of already-known data; Quick Add reachable in one step; key information reachable in ≤2 clicks; ownership, missing information and pending actions always visible; completeness panels are actionable (a "complete now" link, not just a percentage). |
| NFR-008 Localization | Arabic (RTL) and English (LTR) UI; Egyptian phone-number display conventions; EGP currency formatting; a managed governorates list in every location picker; Gregorian dates in `Africa/Cairo`. |
| NFR-009 Mobile | See §10. |
| Loading/empty/error states | Every list, detail and dashboard widget has an explicit loading state, an explicit empty state (never a blank area that could be mistaken for a bug), and an explicit error state with retry where retrying is safe. The full dataset is never loaded into the browser at once — pagination is used everywhere a list can be large. |

---

## 13. Implementation Phases (mirrors `Solar_CRM_SRS_v2.0.md` §19 / `FRONTEND.md` §6)

1. **Foundation**: design tokens, UI kit, i18n, theme, auth, shell, navigation, API layer.
2. **Phase 1 — Core CRM**: leads (bank, my leads, quick add, close, convert), Customer 360, contacts, sites, opportunities, pipeline, next-action enforcement, activities, completeness, notifications, tasks.
3. **Phase 2 — Sales → Technical**: collaborators, technical intake, readiness checklist, handoff, assessments.
4. **Phase 3 — Commercial**: TP/FP/CP screens, register, revisions, negotiation, approvals, contracts → projects.
5. **Phase 4 — Management**: dashboards, exception center, reports, audit, admin.
6. **Phase 5 — Data quality**: duplicates/merge UI, distribution batches, health badges.

---

## 14. Traceability

This document reuses, without renumbering, every requirement ID minted in `Solar_CRM_SRS_v2.0.md` §9. The living implementation-status tracker for these IDs against the target Angular client is `FRONTEND.md` (screen-by-screen ✅/🟡/⬜, including the full existing-feature port inventory E1–E21 that the rewrite must not regress); the equivalent evidence for the already-shipped Next.js client is `docs/uat/milestone-6-checklist.md` and `TEST_REPORT.md`. This SRS is the stable requirements baseline those trackers are measured against — it does not carry a status column and should not be edited to reflect implementation progress; update the trackers instead.

---

## 15. Testing and UAT Requirements

- Every shipped page is verified with a real browser against a real (not mocked) backend and real seeded data, in addition to unit/type-check/build gates — this codebase has repeatedly shipped changes where every static check passed while an entire page returned an error to every user; a page is not considered done until it has been driven in a real browser.
- Both Arabic RTL and English LTR are exercised for every shipped page.
- Both desktop and a 390px mobile viewport are exercised for every shipped page.
- Every shipped page is checked with axe-core in the browser (§11).
- RLS/permission-scope narrowing is verified end-to-end through the UI, not only asserted in a unit test (e.g., a sales rep's list genuinely shows fewer records than a manager's, observed in the rendered page, not merely asserted against a mocked API response).
- The Milestone 6 UAT checklist (`docs/uat/milestone-6-checklist.md`) — mobile/PWA rendering, imports UI, exports/attachments UI, integrations page, and a clean browser console on the key authenticated and public routes — is run in staging before every production release and its results are recorded, per the process in `FINAL_SRS_BACKEND.md` §17.

---

## Appendix A — Existing Feature Inventory (baseline the rewrite must not regress)

Everything below already exists in the current production Next.js client (`FRONTEND.md` §3) and is a **hard floor**, not an aspiration, for the Angular rewrite:

| # | Area | Route(s) | Baseline behavior |
|---|---|---|---|
| E1 | Auth | `/[locale]/login` | E-mail/password login, reason notices (signed out, session expired, account inactive, no profile), return-to redirect, theme toggle before sign-in, sign-out. |
| E2 | App shell | all authenticated routes | Permission-filtered sidebar (Overview/Sales/Solar workflow/Analytics/Operations), mobile drawer, top bar, notification bell (unread count, recent list, mark-all-read on open, deep links), theme toggle, locale switcher preserving path+query, user menu, skip link. |
| E3 | i18n | global | Arabic RTL default + English LTR, full catalogues, localized dates/numbers. |
| E4 | Dashboard | `/dashboard` | Welcome + profile summary, KPI cards, analytics filters, opportunities-by-stage, SLA-driven action list, performance-by-governorate/service, data-quality summary, rep leaderboard, financial values permission-hidden. |
| E5 | Executive dashboard | `/dashboard/executive` | Company-wide KPIs, top reps, data quality, link to reports, gated by permission. |
| E6 | Customers | `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit` | List (search, filters, mine/overdue toggles, pagination, owner, open-opportunity count, overdue highlight), sectioned create/edit, duplicate warning with score, detail (details/assignment cards, contacts table, opportunities table, merged notice). |
| E7 | Contacts | `/customers/:id/contacts/new` | Nested create (name, job title, department, mobile, alt phone, e-mail, preferred channel, decision role, influence, primary, WhatsApp, notes), list on the customer. |
| E8 | Leads | `/leads`, `/leads/new`, `/leads/:id`, `/leads/:id/edit` | List with filters, create/edit, detail with contact-attempt logging, convert panel, disqualify panel (reason + notes). |
| E9 | Opportunities | `/opportunities`, `/new`, `/:id`, `/:id/edit` | List, form, detail with workflow statuses, stage-transition panel (allowed next stages, outcome+reason+contract value), stage history with duration. |
| E10 | Pipeline | `/pipeline` | Kanban board by stage, count+value per column, SLA-breach flag. |
| E11 | Calls | `/calls`, `/new`, `/:id`, `/:id/edit` | Log call, follow-up creates a linked task. |
| E12 | Meetings | `/meetings`, `/new`, `/:id`, `/:id/edit` | Schedule, attendees, complete (minutes/decisions/action items/follow-up), cancel with reason, GPS arrival/departure log with distance and privacy gate. |
| E13 | Site visits | `/visits`, `/new`, `/:id`, `/:id/edit` | Plan visit, GPS check-in/check-out with accuracy, manual reason when GPS unavailable, distance from planned location, outcome/next-action/follow-up, cancel. |
| E14 | Tasks | `/tasks`, `/new`, `/:id`, `/:id/edit` | Views: mine/team/overdue/today/upcoming/all; start/complete(notes)/cancel(reason); priorities. |
| E15 | Solar assessments | `/assessments`, `/new`, `/:id`, `/:id/versions/new`, `/:id/versions/:versionId` | Versioned assessments, monthly bill rows, submit for review, decision (approve/reject/request info), approved versions locked, "request proposal." |
| E16 | Proposal requests | `/proposals`, `/new`, `/:id`, `/:id/edit` | Proposal tracker (technical/financial/overall status, values, validity, customer response), document register, secure download. |
| E17 | Reports | `/reports`, `/reports/:code` | 28 seeded reports in categories, filters, CSV/XLSX/PDF export, queued export jobs. |
| E18 | Imports | `/imports` | CSV upload for leads/customers, validation preview, import job record. |
| E19 | Integrations | `/integrations` | Provider readiness list, secret names only. |
| E20 | Theme | global | Light/dark/system without a flash of the wrong theme, `theme-color` meta. |
| E21 | PWA | global | Manifest + icon, installable, mobile viewport. |

## Appendix B — Route Map (target Angular architecture)

```text
/                         → redirect /ar/dashboard
/:locale/login
/:locale (authGuard, AppShell)
  dashboard, dashboard/executive
  leads, leads/mine, leads/quick-add, leads/new, leads/distribute, leads/:id, leads/:id/edit, leads/:id/convert
  customers, customers/new, customers/:id, customers/:id/edit, customers/:id/contacts/new, customers/:id/sites/new, customers/:id/sites/:siteId/edit
  opportunities, opportunities/new, opportunities/:id, opportunities/:id/edit, opportunities/:id/intake, opportunities/:id/handoff
  pipeline
  calls[/new|/:id|/:id/edit], meetings[...], visits[...], tasks[...]
  assessments[...], handoffs, handoffs/:id
  proposals, proposals/technical/:id, proposals/financial/:id, proposals/combined/:id
  approvals, contracts, contracts/:id, projects, projects/:id
  notifications, exceptions, reports, reports/:code, search
  admin/users, admin/users/:id, admin/roles, admin/teams, admin/reference, admin/audit, admin/automation, admin/imports, admin/integrations
  account/password
** → not-found
```

Every route declares `data: { permission: '<code>' }` and is protected by the functional permission guard. The guard is UX only; the API independently re-checks (§9).

## Appendix C — Field-Format Rules (`CPL-07`, client-side mirror of a server-enforced rule)

Client-side validation shall mirror, and never be looser than, the server-enforced rules: Egyptian mobile/landline number formatting (+20); e-mail format; commercial-registration and tax-ID format; numeric ranges for kWh/kWp/EGP fields; GPS coordinate validity; date logic (e.g., an expected close date may not be in the past). A client-side pass is a UX convenience only — the authoritative rejection is always the server's (`FINAL_SRS_BACKEND.md` §9.7).

## Appendix D — Notification Matrix (reused from `Solar_CRM_SRS_v2.0.md` §12)

| Event | Sales Rep | Sales Mgr | PM | Tech Lead | Engineer | Finance | CEO | Marketing |
|---|---|---|---|---|---|---|---|---|
| Lead assigned (single/batch digest) | ● | ○ | | | | | | |
| SLA approaching / breached | ● | ● (breach) | | | | | | |
| Duplicate detected on create | ● | ○ | | | | | | |
| Ownership conflict / transfer request | ● (both reps) | ● | | | | | ○ (cross-team) | |
| Lead converted to customer | ● (enrichment list) | ○ | ○ | | | | ○ | |
| Enrichment overdue | ● | ● | | | | | | |
| Added as collaborator | | | ● | | | | | |
| Site visit scheduled / approaching / missed | ● | ○ (missed) | ○ | | ● | | | |
| Handoff submitted | | | ● | ● | | | | |
| Handoff returned / clarification | ● | ○ | | | | | | |
| Handoff accepted / engineer assigned | ● | | | ○ | ● | | | |
| TP submitted for review | | | | ● | | | | |
| TP approved / returned | | | ● | | ● | | | |
| FP requires validation | | | | | | ● | | |
| CP pending approval | | | | | | ● (per matrix) | ● (per matrix) | |
| CP released to Sales | ● | | ○ | | | | | |
| Proposal viewed (if tracked) | ● | | ○ | | | | | |
| Revision requested | | | ● | ○ | ● (technical) | | | |
| Follow-up / next action due | ● | | | | | | | |
| Proposal expiring | ● | | ● | | | | | |
| Approval decision | ● (requester) | | ● | | | | | |
| Contract awaiting signature | ● | | ○ | | | ● | | |
| Contract signed / Won | ● | ● | ● | ○ | ○ | ● | ● | ○ |
| Project created | ○ | | ● | | ● | ○ | | |
| Automation failure | Admin | | | | | | | |

● = notify · ○ = FYI/configurable. Collaborators on an opportunity receive the opportunity's key events.

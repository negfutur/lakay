# Lakay AI App Builder Audit

This audit records the verified state of the application before the full AI App Builder upgrade. Status labels distinguish production-backed behavior from interface-only or constrained behavior.

| Requirement | Status | Evidence and boundary |
|---|---|---|
| Natural-language project planning | **REAL** | Server-side structured model calls create persisted project plans from a user description. |
| Natural-language project refinement chat | **REAL** | Authenticated SSE endpoint streams responses and persists conversation messages per project. |
| Analyze existing generated project | **PARTIAL** | The generator receives the project plan and current three static files; it does not parse dependency graphs, routes, schema, tests, or source structure. |
| Create or modify multiple files | **PARTIAL** | The builder generates and updates exactly `index.html`, `styles.css`, and `app.js`; it cannot safely manage arbitrary directories or frameworks. |
| Project context and memory | **PARTIAL** | Project plan, three files, generated versions, and recent chat history persist; no semantic long-term memory, code index, or issue history exists. |
| Automatic error repair | **BROKEN** | No actual build, test, diagnostic, or repair loop currently runs. |
| Runnable front-end application generation | **PARTIAL** | Generated static front-end code runs inside an isolated iframe, but not as a compiled application project. |
| Backend, API, and database generation | **BROKEN** | Lakay currently has no backend project generator, server process per user project, API scaffolding, or generated database migrations. |
| Functional preview and refresh | **PARTIAL** | The sandboxed iframe renders generated static files and refreshes after file queries invalidate. It is not a build server and cannot run a full-stack project. |
| Build/test/error-detection loop | **BROKEN** | No isolated build runner, test runner, error capture, or auto-fix retry mechanism exists. |
| File editing | **REAL** | Authenticated owners can read and update the defined generated files through protected server procedures. |
| Version restoration | **PARTIAL** | Generated and restored snapshots are stored and can be restored. Manual file edits are not yet snapshot versions, so there is no complete undo timeline. |
| Isolated execution | **PARTIAL** | Previews are CSP-restricted sandboxed iframes with no network access; arbitrary user projects do not have an isolated runtime. |
| User and project isolation | **REAL** | Manus OAuth, protected procedures, user-scoped SQL predicates, and router tests protect project, message, file, and build-version access. |
| Stripe payment and usable credits | **BROKEN** | No Stripe integration, webhook verification, credit ledger, idempotency keys, deduction path, or anti-abuse controls are implemented. |
| End-to-end acceptance coverage | **PARTIAL** | Unit tests cover protected CRUD and builder routes. No signed-in browser E2E, real build, auto-fix, payment, credit, or deployment test has run. |

## Critical Architecture Finding

The current managed hosting environment is appropriate for Lakay's control plane, user accounts, project metadata, static previews, protected APIs, and Stripe webhooks. It does not, by itself, provide per-user arbitrary code execution, multi-service project containers, or framework build isolation. A genuine full-stack application builder therefore requires a separate isolated runner service with quotas, no platform-secret exposure, short-lived project environments, and an explicit build/test API.

## Post-Hardening Status Update

| Requirement | Updated status | Verified change or remaining boundary |
|---|---|---|
| Safe multi-file static generation | **PARTIAL** | New generations now use six coordinated static files with cross-file validation; Lakay does not yet support arbitrary folders, dependencies, or framework projects. |
| Project memory and restoration | **REAL** for supported static builds | Immutable snapshots now include manual edits, build summaries, and recent change context used during later generations. |
| Static preview preflight and repair | **PARTIAL** | Server-side static preflight, iframe runtime-error reporting, and a bounded auto-fix path exist. No isolated package build/test runner or live full-stack repair loop exists. |
| Credit ledger and Stripe webhook foundation | **PARTIAL** | User balances, immutable ledger records, atomic update paths, signature verification, duplicate event/session protections, and stable per-request AI idempotency are implemented. Checkout packages and enforcement are intentionally inactive until the owner configures real Stripe products, prices, and webhook delivery. |
| Full Stripe payment verification | **BROKEN / deferred** | It cannot be truthfully verified until the Stripe sandbox is claimed, products and Price IDs are configured, the webhook endpoint is registered, and a real test payment succeeds. |

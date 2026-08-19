# Lakay Execution Boundary

## Current Supported Runtime

Lakay currently builds **isolated static front-end projects** with six coordinated files: `index.html`, `styles.css`, `data.js`, `state.js`, `components.js`, and `app.js`. Each project preview runs inside a sandboxed iframe with a restrictive Content Security Policy. The preview cannot reach the network, platform secrets, server processes, databases, or user credentials.

The static builder has server-side preflight validation, browser runtime-error capture, immutable build versions, and a bounded AI auto-fix path. It is not presented as a general full-stack code runner.

## Required Contract for Full-Stack App Builds

Generating and running arbitrary back-end, API, database, or package-managed projects requires a dedicated runner service outside Lakay's control-plane process. A production runner must provide all of the following.

| Control | Required behavior |
|---|---|
| Tenant isolation | One short-lived, unprivileged environment per project execution. No host mounts or shared writable workspace. |
| Secret isolation | Runner-issued scoped tokens only. Lakay platform secrets, Stripe credentials, and database credentials must never enter generated project containers. |
| Network policy | Deny by default; allowlisted outbound traffic only when an approved integration requires it. |
| Resource limits | Hard CPU, memory, disk, process, and wall-time quotas for install, build, test, and preview phases. |
| Lifecycle | Build and test jobs are ephemeral; preview handles expire and are checked against the authenticated project owner. |
| Database provisioning | Per-project ephemeral or namespaced database credentials; migrations run through a controlled gateway, never with Lakay's primary database credentials. |
| Logs and diagnostics | Sanitized build/test logs linked to a project execution record. Secrets and raw credentials are redacted before persistence or display. |
| Auto-fix | An explicit state machine: generate → build → test → collect sanitized diagnostics → propose/apply fix → rebuild, with bounded retry count and user-visible status. |

## Current Status

The Lakay web application can safely manage the **control plane** for this runner: authenticated users, projects, file versions, generation requests, credit checks, execution records, and preview authorization. The isolated runner itself is not implemented in this managed web application and must be delivered as a separately provisioned execution service before Lakay can truthfully generate or run arbitrary full-stack applications.

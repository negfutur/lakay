# Lakay Runner Job Protocol

## Purpose

Lakay’s web application remains the **control plane**. It may create a user-scoped runner job, persist an unexecuted artifact, and show sanitized job state. It must never install dependencies or execute generated full-stack code in its own server process.

## Job Lifecycle

`queued → runner_assigned → installing → building → testing → preview_ready`

Failures may transition to `failed`; in-progress jobs may become `cancelled` or `expired`. Terminal jobs never return to an active state. The control plane rejects all invalid transitions.

## Handoff Requirements

Each job holds an expiration time, a hashed single-use handoff credential, and a signed claim containing only the project ID, user ID, expiry, and nonce. The raw credential is never written to browser-visible state, logs, or project files; browser responses expose only safe job lifecycle fields. A separately provisioned isolated runner receives its scoped handoff through a secure deployment channel and must enforce project ownership, claim expiry, ephemeral workspace lifetime, scoped secrets, and deny-by-default networking.

## Artifact and Logs

The artifact contains only the validated runner manifest, unexecuted scaffold files, policy metadata, and signed claim. It never includes Lakay platform secrets, primary database credentials, payment credentials, or user sessions. Runner logs are sanitized before persistence; token, API key, password, database URL, and bearer credential patterns are redacted. The control plane automatically expires unclaimed active jobs when a project workspace is retrieved.

## Activation Boundary

The protocol and UI can queue a job, but **no runner is connected yet**. A future runner deployment must supply the secure job-claim/callback channel before queued jobs can move beyond `queued`.

# Gemini Background Tasks — Lakay Implementation Record

Lakay will use Gemini’s documented **Interactions API** for long-running work, rather than adding unsupported `background` or `store` parameters to the existing `generateContent` path. A request with `background: true` returns immediately with an interaction identifier. Lakay must store that identifier only on the server, together with its own owner-scoped task identifier and durable task status.

The supported Gemini execution states are `in_progress`, `requires_action`, `completed`, `failed`, and `cancelled`. Lakay adds `queued` before the upstream interaction is created so the user has a durable state from the first server transaction. A task can be refreshed after reconnection by reading Lakay’s persisted task record and synchronizing the upstream interaction status. Cancellation maps to Gemini’s documented interaction cancellation endpoint.

Gemini’s Interactions API supports the exact persisted execution inputs Lakay needs: `background: true`, `store: true`, an optional `system_instruction`, `generation_config.max_output_tokens`, structured `response_format` with JSON schema, and a persistent interaction identifier. The interaction can be retrieved through `GET /v1beta/interactions/{id}` and cancelled through `POST /v1beta/interactions/{id}/cancel`. Lakay will map Gemini’s interaction states to its public task state without exposing the upstream API key or raw provider payload.

The final generated output must be persisted into Lakay’s project version and conversation records only after the upstream interaction reports `completed` and passes the same structured validation used by synchronous Builder generation. A page refresh or closed browser must not discard the Lakay task record, Gemini interaction identifier, status, last update, or final result metadata.

## Boundaries

Lakay’s API key remains server-only. The browser receives Lakay task IDs and sanitized progress text, never a Gemini API key or raw provider error payload. The existing synchronous route remains available for short questions; background interactions are reserved for long generation, repair, or multi-step work.

## Official source

- [Gemini API — Background execution](https://ai.google.dev/gemini-api/docs/background-execution), accessed 2026-08-26.
- [Gemini Interactions API reference](https://ai.google.dev/api/interactions-api), accessed 2026-08-26.
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), accessed 2026-08-26.

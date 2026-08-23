# Build Failure Recovery Verification

The mobile project preview was verified at **375 × 812** after the application server settled. For a project without generated files, Lakay now presents a clear French state: the preview will appear only after generation, with direct guidance to use **Créer** or send a chat instruction. The state no longer describes an unbuilt project as completed.

The client transport now rejects a non-JSON API response before the tRPC parser emits the raw `Unexpected token '<'` error. The workspace records a friendly recovery message, preserves any existing sandbox preview, and provides a retry action.

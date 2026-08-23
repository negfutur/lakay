# Minimal UI visual verification

The direct-access landing page and App Builder were checked at 1280 × 720 and 375 × 812. The home page now presents a single clear creation path, with authentication or project access available in the header and no workflow, capability, or marketing-detail sections.

The desktop workspace shows one compact project header, a centered Aperçu/Chat switcher, and a transparent assistant response without the former technical disclaimer. At 375px, the compact project name is constrained to leave clear separation from the centered switcher; preview controls remain accessible on their own row without horizontal page overflow.

The guided project handoff was reviewed at 375 × 812 using the created-project route state. Lakay opens the Chat pane directly, displays a French assistant follow-up that references the original idea, and retains the floating composer inside the visible viewport. Automated coverage verifies that the active build keeps chat visible and then switches mobile users to the preview when the build returns.

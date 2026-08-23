# Workspace visual verification

## 2026-08-23

The builder was checked at 1280 × 720 and 375 × 812 against an existing user-scoped project. Desktop shows an even Preview/Chat split, visible Files/Code/Preview/Runner/Logs/Changes navigation, compact toolbar actions, and the header Export/Publish controls. Mobile shows the Chat/Aperçu switch with Aperçu initially selected, a compact action toolbar, and preview mode controls without page-level horizontal overflow.

The initial mobile check identified individual sandbox navigation labels wrapping mid-word at narrow widths. The preview foundation now keeps each navigation link/button label intact and allows generated header/menu groups to grow and wrap rather than clipping the next item. This preserves the sandbox boundary while avoiding oversized or clipped menu text.

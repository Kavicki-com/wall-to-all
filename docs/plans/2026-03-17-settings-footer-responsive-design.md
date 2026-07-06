# Settings Footer Responsive Design

**Context**

The client and merchant settings screens currently share the same visual language, but they do not share the same layout behavior. The client screen constrains the options list with a local `maxWidth`, while the merchant screen relies more on the container width. In both screens, the `Sair` action is rendered inside the scroll/content area, so on larger emulator windows it appears visually detached from the tab bar instead of behaving like a bottom action.

**Approved Outcome**

Keep the screens visually like the reference: a centered single column for avatar, identity, and setting cards. Move the `Sair` action out of the page content and into the `ScreenContainer` footer so it stays positioned just above the tab bar on both client and merchant flows.

**Design**

Use the same layout strategy for both settings screens:

- Keep a centered content column with a shared maximum width.
- Keep the cards in a single stacked column.
- Use `scroll={true}` so smaller devices can still reach the full content safely.
- Render `Sair` through the `footer` prop of `ScreenContainer` instead of inline in the page body.

This preserves the current visual proportions while making the footer placement consistent across screen heights and widths.

**Non-goals**

- No redesign of the tab bar.
- No tablet-specific multi-column layout.
- No changes to settings item order or copy.

**Verification**

- Add a regression test covering footer rendering for both settings screens.
- Run the focused Jest test and typecheck after implementation.

# Settings Footer Responsive Implementation Plan

**Goal:** Keep both settings screens visually centered like the approved reference while pinning the `Sair` action above the tab bar through `ScreenContainer` footer handling.

**Architecture:** Both settings screens will share the same structural pattern: scrollable content for the profile header and options list, plus a footer-hosted logout button. The implementation keeps the existing visual hierarchy and removes the positional drift caused by rendering `Sair` inside the content body.

**Tech Stack:** Expo Router, React Native, TypeScript, Jest, @testing-library/react-native

---

### Task 1: Add regression coverage for footer placement

**Files:**

- Create: `__tests__/settings-layout.test.tsx`
- Reference: `app/(client)/settings/index.tsx`
- Reference: `app/(merchant)/settings/index.tsx`

**Step 1: Write the failing test**

Create a test that renders each settings screen with mocked providers and asserts:

- the `Sair` button is present
- the mocked `ScreenContainer` receives a `footer`
- the options list still renders the existing settings actions

**Step 2: Run test to verify it fails**

Run: `npm test -- settings-layout.test.tsx --runInBand`

Expected: FAIL because the screens still render `Sair` inline and do not pass a footer prop.

**Step 3: Write minimal implementation**

Update both settings screens to:

- extract a shared centered column width rule
- pass the logout button via `footer`
- keep the main content inside the scroll area

**Step 4: Run test to verify it passes**

Run: `npm test -- settings-layout.test.tsx --runInBand`

Expected: PASS

### Task 2: Align both settings screens with the approved layout

**Files:**

- Modify: `app/(client)/settings/index.tsx`
- Modify: `app/(merchant)/settings/index.tsx`

**Step 1: Move logout to footer**

Replace inline logout rendering with:

```tsx
footer={
  <CustomButton
    title="Sair"
    variant="ghost"
    onPress={handleLogout}
    style={styles.logoutButton}
  />
}
```

**Step 2: Make both screens use the same content structure**

- Set `scroll={true}` on both screens.
- Keep a centered profile block.
- Keep a centered options container with a shared `maxWidth`.
- Remove any extra wrapper that only exists to hold logout spacing.

**Step 3: Keep visual spacing stable**

Add styles for:

- `contentColumn`
- `optionsContainer`
- `logoutButton`

So the content keeps the approved single-column look while the footer is consistently anchored.

### Task 3: Verify the change

**Files:**

- Modify: `__tests__/settings-layout.test.tsx` if needed

**Step 1: Run focused test**

Run: `npm test -- settings-layout.test.tsx --runInBand`

Expected: PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: exit code 0

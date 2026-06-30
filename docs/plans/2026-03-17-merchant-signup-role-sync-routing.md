# Merchant Signup Role Sync Routing Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure a user who finishes the merchant signup flow lands in the merchant area on the first post-signup navigation, without needing to log out and log back in.

**Architecture:** The fix should synchronize the in-memory auth role immediately after the merchant profile is finalized and before leaving the signup flow. We will expose an explicit `refreshUserRole` helper from `AuthContext`, call it from the merchant signup loading screen after the `profiles` upsert succeeds, and preserve the current product expectation of navigating to the merchant dashboard.

**Tech Stack:** Expo Router, React Native, TypeScript, Supabase JS, Jest, @testing-library/react-native

---

### Task 1: Add regression coverage for explicit role refresh in AuthContext

**Files:**

- Create: `__tests__/auth-context-role-refresh.test.tsx`
- Modify: `context/AuthContext.tsx`
- Reference: `lib/hooks/useAuthRouting.ts`

**Step 1: Write the failing test**

Create a focused test that mounts `AuthProvider` with mocked Supabase responses and proves the in-memory role can be refreshed during an active session:

```tsx
it('updates the in-memory role after the profile user_type changes', async () => {
  const roles: Array<'client' | 'merchant' | null> = [];
  let triggerRefresh: (() => Promise<unknown>) | undefined;

  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
    error: null,
  });

  profileResponses.push({ data: { user_type: 'client' }, error: null });
  profileResponses.push({ data: { user_type: 'merchant' }, error: null });

  const Consumer = () => {
    const { userRole, refreshUserRole } = useAuth();
    roles.push(userRole);
    triggerRefresh = () => refreshUserRole('user-1');
    return null;
  };

  render(
    <ToastProviderMock>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </ToastProviderMock>
  );

  await waitFor(() => expect(roles).toContain('client'));

  await act(async () => {
    await triggerRefresh?.();
  });

  await waitFor(() => expect(roles).toContain('merchant'));
});
```

The mocks should make the first `profiles` lookup return `client` and the second return `merchant`.

**Step 2: Run test to verify it fails**

Run: `npm test -- auth-context-role-refresh.test.tsx --runInBand`

Expected: FAIL because `AuthContext` does not yet expose a `refreshUserRole` method.

**Step 3: Write minimal implementation**

Update `context/AuthContext.tsx` to:

- extend `AuthContextType` with `refreshUserRole: (userId?: string) => Promise<UserRole>`
- implement `refreshUserRole` by:
  - resolving the target user id from the argument or current session
  - calling the existing `fetchUserRole`
  - updating `setUserRole(role)`
  - returning the fetched role
- keep the existing initialization and `onAuthStateChange` behavior unchanged

Minimal implementation shape:

```tsx
const refreshUserRole = async (userId?: string): Promise<UserRole> => {
  const targetUserId = userId ?? session?.user?.id;

  if (!targetUserId) {
    setUserRole(null);
    return null;
  }

  const role = await fetchUserRole(targetUserId);
  setUserRole(role);
  return role;
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- auth-context-role-refresh.test.tsx --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add __tests__/auth-context-role-refresh.test.tsx context/AuthContext.tsx
git commit -m "test: add auth role refresh coverage"
```

### Task 2: Add a signup regression test for merchant post-signup routing

**Files:**

- Create: `__tests__/merchant-signup-loading.test.tsx`
- Reference: `app/(auth)/merchant-signup-loading.tsx`
- Reference: `context/AuthContext.tsx`

**Step 1: Write the failing test**

Create a screen-level regression test that mocks a successful merchant signup finalization and verifies the loading screen refreshes the role before navigating:

```tsx
it('refreshes the merchant role before navigating to the dashboard', async () => {
  jest.useFakeTimers();

  mockAsyncStorage.getItem.mockResolvedValue(
    JSON.stringify({
      is_oauth: true,
      full_name: 'Merchant Test',
      email: 'merchant@test.com',
      signup_started_at: '2026-03-17T10:00:00.000Z',
      business_name: 'Oficina Teste',
      category_id: 1,
      description: 'Descricao',
      address: 'Rua A, 123',
      business_time: '08:00-18:00',
      work_days: {},
      accepted_payment_methods: ['pix'],
      services: [],
    })
  );

  mockGetSession
    .mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'merchant@test.com' } } },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'merchant@test.com' } } },
      error: null,
    });

  const refreshUserRole = jest.fn().mockResolvedValue('merchant');

  render(<MerchantSignupLoadingScreen />, {
    wrapper: createAuthWrapper({ refreshUserRole }),
  });

  await act(async () => {
    jest.advanceTimersByTime(1500);
  });

  await waitFor(() => expect(refreshUserRole).toHaveBeenCalledWith('user-1'));
  expect(refreshUserRole.mock.invocationCallOrder[0]).toBeLessThan(
    mockRouter.replace.mock.invocationCallOrder[0]
  );
  expect(mockRouter.replace).toHaveBeenCalledWith('/(merchant)/dashboard');
});
```

Keep the draft data minimal so the test does not need image upload or service insertion branches.

**Step 2: Run test to verify it fails**

Run: `npm test -- merchant-signup-loading.test.tsx --runInBand`

Expected: FAIL because the screen currently navigates without refreshing the in-memory role.

**Step 3: Keep mocks limited to the success path**

Mock only the calls needed for the happy path:

- `AsyncStorage.getItem` and `removeItem`
- `supabase.auth.getSession`
- `supabase.from('profiles').upsert`
- `supabase.from('business_profiles').upsert(...).select('id').single()`
- `useToast`
- `useRouter`

Do not mock image uploads or service creation in this first regression.

**Step 4: Re-run the test until the failure message is the right one**

Run: `npm test -- merchant-signup-loading.test.tsx --runInBand`

Expected: FAIL specifically because `refreshUserRole` was not called before navigation, not because the screen crashed from incomplete mocks.

**Step 5: Commit**

```bash
git add __tests__/merchant-signup-loading.test.tsx
git commit -m "test: capture merchant signup routing regression"
```

### Task 3: Synchronize the role before leaving the merchant signup flow

**Files:**

- Modify: `app/(auth)/merchant-signup-loading.tsx`
- Reference: `context/AuthContext.tsx`
- Reference: `lib/hooks/useAuthRouting.ts`

**Step 1: Read auth context from the signup loading screen**

Import and use the auth hook:

```tsx
import { useAuth } from '../../context/AuthContext';

const { refreshUserRole } = useAuth();
```

**Step 2: Refresh the role after the profile upsert succeeds**

After the `profiles` and `business_profiles` upserts complete and before any success navigation, synchronize the role:

```tsx
const refreshedRole = await refreshUserRole(user.id);
```

Place this before:

- the success `Alert.alert(... router.replace('/(merchant)/dashboard'))`
- the direct `router.replace('/(merchant)/dashboard')`

**Step 3: Keep the current merchant destination**

Do not change the product destination in this fix. Preserve:

```tsx
router.replace('/(merchant)/dashboard');
```

The objective is to remove the stale-role race, not to change the first screen after signup.

**Step 4: Add a defensive dev log**

If the refreshed role is not `'merchant'`, log it in development so future production traces are easier to read:

```tsx
if (__DEV__ && refreshedRole !== 'merchant') {
  logger.warn('[MerchantSignupLoading] refreshUserRole retornou role inesperada:', refreshedRole);
}
```

Do not add a second fallback navigation in this first fix.

**Step 5: Run the focused test to verify it passes**

Run: `npm test -- merchant-signup-loading.test.tsx --runInBand`

Expected: PASS

### Task 4: Verify the full fix

**Files:**

- Reference: `__tests__/auth-context-role-refresh.test.tsx`
- Reference: `__tests__/merchant-signup-loading.test.tsx`

**Step 1: Run both focused regression tests**

Run: `npm test -- auth-context-role-refresh.test.tsx merchant-signup-loading.test.tsx --runInBand`

Expected: PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: exit code 0

**Step 3: Manual product verification**

In the merchant signup flow:

1. complete the final signup step
2. confirm the first post-signup screen stays in `/(merchant)`
3. confirm logout and login still open the merchant area normally

**Step 4: Commit**

```bash
git add context/AuthContext.tsx app/(auth)/merchant-signup-loading.tsx __tests__/auth-context-role-refresh.test.tsx __tests__/merchant-signup-loading.test.tsx
git commit -m "fix: sync merchant role before post-signup routing"
```

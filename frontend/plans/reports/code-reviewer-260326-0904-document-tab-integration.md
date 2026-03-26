# Code Review: Document Tab Integration

**Branch:** feat/v2.29
**Date:** 2026-03-26
**Scope:** 4 files (1 new Apollo client, 1 new component, 2 modified)

---

## Overall Assessment

Solid integration. The separate Apollo client approach is correct for a different microservice. Main concerns: **shared httpLink/authLink singleton bug**, **missing token caching** in the design-doc client, **`any` types**, and a **sidebar overflow issue** with 6 tabs.

---

## Critical Issues

### C1. Shared singleton httpLink/authLink across multiple clients (BUG)

**File:** `frontend/src/apollo/design-doc-client.ts` lines 7-25

`httpLink` and `authLink` are module-level singletons, but `createDesignDocClient()` is a factory called per-render via `useMemo`. The links themselves are fine to share (they're stateless), BUT they are created once at module load time. If `NEXT_PUBLIC_DESIGN_DOC_API_URL` changes at runtime (e.g. different env per request in SSR), the URL is stale.

**Severity:** Medium (not critical for client-only usage, but breaks SSR/edge cases)

**Fix:** Move link creation inside the factory, or document that this is client-only.

### C2. Missing error handling on `createSystem` mutation

**File:** `frontend/src/components/projects/DocumentsTab.tsx` line 45

`handleCreate` has no try/catch. If `createSystem` fails, the promise rejection is unhandled -- React will not catch it and the user sees no error feedback.

```tsx
// Current (line 43-51)
const handleCreate = async () => {
  if (!name.trim()) return;
  await createSystem({...}); // unhandled rejection
  ...
};

// Fix
const handleCreate = async () => {
  if (!name.trim()) return;
  try {
    await createSystem({
      variables: { input: { projectId: numericProjectId, name: name.trim(), description: null } },
    });
    setName('');
    setShowForm(false);
    refetch();
  } catch (err) {
    console.error('Failed to create system:', err);
    // TODO: show toast/inline error
  }
};
```

---

## High Priority

### H1. No token caching -- every GraphQL request triggers a fetch to `/api/auth/get-token`

**File:** `frontend/src/apollo/design-doc-client.ts` lines 11-24

The main `client.ts` has token caching with 10-min expiry and deduplication (`tokenFetchPromise`). The design-doc client fetches a fresh token on every single request. Under normal usage this means 2x token fetches per page load (one from each client).

**Fix:** Extract the `getAuthToken` function from `client.ts` into a shared `auth-token.ts` module and reuse it in both clients. This also avoids the DRY violation.

### H2. `useMemo(() => createDesignDocClient(), [])` -- empty deps creates one client per component lifetime

**File:** `frontend/src/components/projects/DocumentsTab.tsx` line 19

The empty dependency array means a new ApolloClient is created once when `DocumentsTab` mounts but never recreated if the user navigates away and back. This is correct behavior for the `key={projectId}` pattern on the ApolloProvider (line 22), which forces re-mount on project change. However, every re-mount creates a **new InMemoryCache** -- meaning previous query results are discarded and re-fetched.

**Severity:** Medium-High for UX. Navigating between projects triggers full re-fetches every time.

**Recommendation:** Lift the client to a module-level singleton (like the main client) or use `useRef` to persist across re-mounts. The cache would then survive project switches.

### H3. `any` type on system map callback

**File:** `frontend/src/components/projects/DocumentsTab.tsx` line 137

```tsx
{systems.map((system: any) => (
```

The query returns typed data from `GET_SYSTEMS`. Define and use a proper interface:

```tsx
interface DesignSystem {
  id: string;
  projectId: number;
  name: string;
  description: string | null;
  modules?: { id: string; name: string }[];
}
```

---

## Medium Priority

### M1. Sidebar `max-h-72` may not accommodate 6 tabs

**File:** `frontend/src/components/ui/navigation/sidebar-project-tree-item.tsx` line 65

With the addition of the "documents" tab, there are now 6 sub-tabs. Each tab row is roughly `py-1.5` (~36px). 6 tabs = ~216px. `max-h-72` = 288px, so it fits now, but barely. Adding one more tab will clip.

**Fix:** Consider `max-h-96` or use a dynamic approach.

### M2. `parseInt(projectId, 10)` silently produces `NaN` for UUID strings

**File:** `frontend/src/components/projects/DocumentsTab.tsx` line 31

The main backend uses UUID strings for project IDs (confirmed: `$projectId: UUID!` in GraphQL schema). `parseInt("550e8400-e29b-41d4-a716-446655440000", 10)` returns `550` -- a valid but WRONG integer. The `isNaN` check only catches purely non-numeric strings.

**This is a data integrity bug.** UUID strings like `"550e8400-..."` parse to `550`, which could match an unrelated project in design-doc-service.

**Fix:** Validate that the entire string is numeric, not just the prefix:

```tsx
const numericProjectId = Number(projectId);
const isValidId = Number.isInteger(numericProjectId) && numericProjectId > 0 && String(numericProjectId) === projectId;
```

Or use a regex: `/^\d+$/.test(projectId)`.

**Note:** This raises an architectural question -- how does the design-doc-service map its `Int!` project IDs to the main backend's UUID project IDs? This needs a mapping strategy.

### M3. `name` not trimmed before sending to mutation

**File:** `frontend/src/components/projects/DocumentsTab.tsx` line 46

`name.trim()` is checked for emptiness but the raw `name` (with leading/trailing spaces) is sent in the mutation variable. Use `name.trim()` in the variables too.

### M4. Missing `loading` state on create button

When `handleCreate` is running, the user can click "Create" multiple times, creating duplicates.

**Fix:** Track mutation loading state:
```tsx
const [createSystem, { loading: creating }] = useMutation(CREATE_SYSTEM);
// ... then disable button:
<button onClick={handleCreate} disabled={creating} ...>
```

---

## Low Priority

### L1. Debug `console.log` statements in ProjectDetailView

**File:** `frontend/src/components/projects/ProjectDetailView.tsx` -- lines 76, 88, 99, 106, etc.

Many Vietnamese-language console.log statements remain. These should be removed or gated behind a debug flag before merging.

### L2. `handleDataProcessing` defined as arrow function inside component body

**File:** `frontend/src/components/projects/ProjectDetailView.tsx` line 145

This is recreated on every render. Could be wrapped in `useCallback` or moved outside the component since it only depends on `dispatch`.

---

## Edge Cases Found

1. **UUID-to-Int conversion** (M2 above) -- most critical edge case. UUID project IDs will silently produce wrong integers.
2. **Concurrent project switching** -- `key={projectId}` on ApolloProvider unmounts/remounts correctly, but the old client's in-flight requests are not cancelled. Could cause brief flash of stale data.
3. **Auth token race** -- If the main client and design-doc client both call `/api/auth/get-token` simultaneously on page load, two redundant network requests occur.
4. **Empty system name** -- User can type only spaces, which passes `name.trim()` check but sends whitespace-padded string to API.

---

## Positive Observations

- Clean separation of concerns: dedicated Apollo client for the microservice
- `key={projectId}` pattern correctly forces re-mount on project change
- `skip: !isValidId` prevents invalid queries
- Dark theme classes are consistent with existing project components
- Error and loading states are handled
- New tab integrates cleanly into existing ViewType union and sidebar

---

## Recommended Actions (Priority Order)

1. **Fix UUID-to-Int parsing** (M2) -- this is a silent data corruption risk
2. **Add try/catch to handleCreate** (C2)
3. **Extract shared getAuthToken** (H1) -- DRY + performance
4. **Add `creating` loading state** (M4) -- prevents duplicates
5. **Type the system objects** (H3) -- remove `any`
6. **Trim name in mutation variables** (M3)
7. **Clean up console.log** (L1)

---

## Unresolved Questions

1. **Int vs UUID mapping**: How does design-doc-service's `projectId: Int!` relate to the main backend's UUID project IDs? Is there a mapping table? If not, the Documents tab will never work correctly with real project data -- this is an architectural gap that needs resolution before this feature ships.
2. **Access control**: Does design-doc-service enforce its own auth/permissions, or does it trust the JWT from the main backend? If the latter, are the user roles consistent between services?
3. **Should the design-doc Apollo client be a singleton?** Current factory pattern creates new cache per mount. Clarify intended caching behavior.

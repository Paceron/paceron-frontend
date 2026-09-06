# UX Error & Network Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every request a 30s timeout, translate network/timeout/5xx failures into user-facing Spanish messages, and add a root-level `ErrorBoundary` so a render crash shows a recoverable screen instead of a blank/frozen app.

**Architecture:** `services/api.js` wraps its `fetch()` call with `AbortController` (30s timeout) and a `try/catch` that routes network/timeout failures through a new pure-function module (`utils/network-errors.js`); the existing HTTP-error branch routes through the same module for 5xx/4xx message selection. A new class component (`components/shared/error-boundary.jsx`) is mounted once at the root of `app/_layout.jsx`.

**Tech Stack:** React Native + Expo Router, Jest (fake timers for the timeout test), `expo-updates` (already a dependency, used for the reload action).

**Spec:** `docs/superpowers/specs/2026-09-06-ux-error-network-handling-design.md`

## Global Constraints

- Timeout is a fixed **30000ms** constant, no per-request override (spec §1 — must exceed Render's ~20-25s cold-start).
- Exact message strings (spec §2, do not paraphrase):
  - Timeout (`AbortError`): `'La conexión tardó demasiado. Probá de nuevo.'`
  - Network failure (any other fetch rejection): `'No pudimos conectarnos. Revisá tu conexión a internet.'`
  - HTTP 5xx with no `body.message`: `'Hubo un problema en el servidor. Probá de nuevo en unos minutos.'`
  - HTTP 4xx (or any status) with `body.message` present: use `body.message` unchanged.
  - HTTP with no `body.message` and status < 500: `` `Request failed with status ${status}` `` (unchanged from current behavior).
- `error.status` continues to be set in `services/api.js` itself, not inside `mapHttpErrorMessage` — that function only computes the message string.
- No existing `Toast.show({ text2: error.message })` call site is modified — they inherit the new behavior for free.
- No retry logic, no crash-reporting service, no new dependency (`expo-updates` is already in `package.json`).
- `ErrorBoundary` mounts exactly once, at the root of `app/_layout.jsx`, wrapping everything including `AppProviders`.
- All visual elements (`View`, `Text`, `Pressable`) in `ErrorBoundary` need both `nativeID` and `testID` (project-wide rule, `CLAUDE.md` "Identificadores de componentes").
- Use `isWeb` from `utils/platform.js` for platform branching — not a direct `Platform.OS` check (project convention, matches every other platform-branch in the repo).
- No render tests for `ErrorBoundary` (project convention, `CLAUDE.md` Testing section) — verified manually in preview instead.

---

### Task 1: `utils/network-errors.js` — pure error-mapping functions

**Files:**
- Create: `utils/network-errors.js`
- Test: `__tests__/network-errors.test.js`

**Interfaces:**
- Produces: `mapNetworkError(err)` → `Error` (used by Task 2's `services/api.js`).
- Produces: `mapHttpErrorMessage(status, backendMessage)` → `string` (used by Task 2's `services/api.js`).

- [ ] **Step 1: Write the failing tests**

```js
// __tests__/network-errors.test.js
import { mapNetworkError, mapHttpErrorMessage } from '../utils/network-errors.js';

describe('mapNetworkError', () => {
  test('maps an AbortError to a timeout message', () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    const result = mapNetworkError(abortError);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('La conexión tardó demasiado. Probá de nuevo.');
  });

  test('maps any other fetch failure to a connectivity message', () => {
    const networkError = new TypeError('Failed to fetch');

    const result = mapNetworkError(networkError);

    expect(result.message).toBe('No pudimos conectarnos. Revisá tu conexión a internet.');
  });
});

describe('mapHttpErrorMessage', () => {
  test('returns the backend message unchanged when present, regardless of status', () => {
    expect(mapHttpErrorMessage(404, 'Ya existe un usuario con ese email.')).toBe('Ya existe un usuario con ese email.');
    expect(mapHttpErrorMessage(500, 'Mantenimiento programado.')).toBe('Mantenimiento programado.');
  });

  test('returns a friendly server message for 5xx with no backend message', () => {
    expect(mapHttpErrorMessage(500, undefined)).toBe('Hubo un problema en el servidor. Probá de nuevo en unos minutos.');
    expect(mapHttpErrorMessage(503, undefined)).toBe('Hubo un problema en el servidor. Probá de nuevo en unos minutos.');
  });

  test('returns the generic status fallback for non-5xx with no backend message', () => {
    expect(mapHttpErrorMessage(404, undefined)).toBe('Request failed with status 404');
    expect(mapHttpErrorMessage(400, undefined)).toBe('Request failed with status 400');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/network-errors.test.js`
Expected: FAIL with "Cannot find module '../utils/network-errors.js'"

- [ ] **Step 3: Write the implementation**

```js
// utils/network-errors.js

export function mapNetworkError(err) {
  if (err?.name === 'AbortError') {
    return new Error('La conexión tardó demasiado. Probá de nuevo.');
  }
  return new Error('No pudimos conectarnos. Revisá tu conexión a internet.');
}

export function mapHttpErrorMessage(status, backendMessage) {
  if (backendMessage) return backendMessage;
  if (status >= 500) return 'Hubo un problema en el servidor. Probá de nuevo en unos minutos.';
  return `Request failed with status ${status}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/network-errors.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add utils/network-errors.js __tests__/network-errors.test.js
git commit -m "feat(errors): add pure network/HTTP error message mapping"
```

---

### Task 2: Timeout + `AbortController` + error mapping in `services/api.js`

**Files:**
- Modify: `services/api.js` (the `request` function and the `if (!response.ok)` block)
- Modify: `__tests__/api-client.test.js` (add 2 new tests)

**Interfaces:**
- Consumes: `mapNetworkError(err)` and `mapHttpErrorMessage(status, backendMessage)` from Task 1's `utils/network-errors.js`.

- [ ] **Step 1: Write the failing tests**

Add these two tests to the existing `describe('api client error handling', ...)` block in `__tests__/api-client.test.js` (after the existing 3 tests, before the closing `});` of that block):

```js
  test('maps a timeout (AbortError) to a friendly message', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        reject(abortError);
      });
    }));

    const pending = expect(api.get('/teams')).rejects.toMatchObject({
      message: 'La conexión tardó demasiado. Probá de nuevo.',
    });
    jest.advanceTimersByTime(30000);
    await pending;
    jest.useRealTimers();
  });

  test('maps a network failure (fetch rejects) to a connectivity message', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(api.get('/teams')).rejects.toMatchObject({
      message: 'No pudimos conectarnos. Revisá tu conexión a internet.',
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/api-client.test.js`
Expected: The 2 new tests FAIL — no timeout exists yet, so the timeout test hangs/fails, and the network-failure test currently propagates the raw `TypeError` instead of the mapped message.

- [ ] **Step 3: Modify `services/api.js`**

Add the import at the top of the file:

```js
import { mapNetworkError, mapHttpErrorMessage } from '../utils/network-errors.js';
```

Add the timeout constant right after the imports:

```js
const REQUEST_TIMEOUT_MS = 30000;
```

Replace the current `fetch` call:

```js
  const response = await fetch(buildUrl(path), {
    ...fetchOptions,
    headers,
  });
```

with:

```js
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(buildUrl(path), {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    throw mapNetworkError(err);
  } finally {
    clearTimeout(timeoutId);
  }
```

Replace the current error-response block:

```js
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // sin cuerpo JSON — se usa el mensaje por defecto
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
```

with:

```js
  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      // sin cuerpo JSON — se usa el mensaje por defecto
    }
    const error = new Error(mapHttpErrorMessage(response.status, body?.message));
    error.status = response.status;
    throw error;
  }
```

The 401-refresh-retry block in between (lines checking `response.status === 401`) stays exactly as-is — it already operates on the resolved `response` variable, which the new `try/catch` still produces before that block runs.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/api-client.test.js`
Expected: PASS (all tests in the file, including the 2 new ones and the pre-existing ones — the pre-existing tests' mocked `fetch` implementations ignore the extra `signal` option harmlessly).

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npm test`
Expected: PASS, same total count as before plus the 2 new tests (no other file calls `services/api.js`'s internals directly in a way the timeout/signal change would break — every other consumer goes through the same `request()` function).

- [ ] **Step 6: Commit**

```bash
git add services/api.js __tests__/api-client.test.js
git commit -m "feat(api): add 30s request timeout and map network/timeout errors"
```

---

### Task 3: `ErrorBoundary` component, mounted at the app root

**Files:**
- Create: `components/shared/error-boundary.jsx`
- Modify: `app/_layout.jsx`

**Interfaces:**
- Produces: `ErrorBoundary` (default export is NOT used — it's a named export `export class ErrorBoundary`), consumed by `app/_layout.jsx`.

- [ ] **Step 1: Create the component**

```jsx
// components/shared/error-boundary.jsx
import { Component } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Updates from 'expo-updates';
import { isWeb } from '../../utils/platform.js';

async function reloadApp() {
  if (isWeb) {
    window.location.reload();
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch {
    // Expo Go / dev build sin runtime de updates activo — no hay más
    // acción posible, el usuario cierra y reabre la app a mano.
  }
}

export class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View
        nativeID="error-boundary-fallback"
        testID="error-boundary-fallback"
        className="flex-1 items-center justify-center bg-white dark:bg-surface px-8"
      >
        <Text
          nativeID="error-boundary-title"
          testID="error-boundary-title"
          className="text-lg font-semibold text-slate-900 dark:text-white text-center mb-2"
        >
          Algo salió mal
        </Text>
        <Text
          nativeID="error-boundary-description"
          testID="error-boundary-description"
          className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6"
        >
          Tuvimos un problema inesperado. Probá recargar la app.
        </Text>
        <Pressable
          nativeID="error-boundary-reload-button"
          testID="error-boundary-reload-button"
          onPress={reloadApp}
          className="bg-primary px-6 py-3 rounded-xl"
        >
          <Text
            nativeID="error-boundary-reload-button-text"
            testID="error-boundary-reload-button-text"
            className="text-white font-semibold"
          >
            Recargar
          </Text>
        </Pressable>
      </View>
    );
  }
}
```

- [ ] **Step 2: Mount it in `app/_layout.jsx`**

Add the import:

```js
import { ErrorBoundary } from '../components/shared/error-boundary.jsx';
```

Wrap the existing return value of `RootLayout`. Current code:

```jsx
  return (
    <SafeAreaProvider>
      <AppProviders>
        <StackNavigator />
        <RoleSwitchOverlay />
        <Toast config={toastConfig} topOffset={56} />
      </AppProviders>
    </SafeAreaProvider>
  );
```

becomes:

```jsx
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppProviders>
          <StackNavigator />
          <RoleSwitchOverlay />
          <Toast config={toastConfig} topOffset={56} />
        </AppProviders>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
```

- [ ] **Step 3: Run the full test suite to check for regressions**

Run: `npm test`
Expected: PASS, same count as after Task 2 (no test exercises `app/_layout.jsx` directly — this is a structural JSX change only).

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: PASS — `ErrorBoundary`'s `View`/`Text`/`Pressable` all carry both `nativeID` and `testID`, satisfying `local/require-native-id`.

- [ ] **Step 5: Manual verification in preview**

No render test exists for this component (project convention). Verify by hand:
1. Temporarily add `throw new Error('test crash')` inside any screen's render body (e.g. the top of `TeamsListScreen`'s function body).
2. Reload the web preview, navigate to that screen.
3. Confirm the fallback UI renders ("Algo salió mal" / "Recargar" button) instead of a blank page or a dev red-box-only crash.
4. Click "Recargar" and confirm `window.location.reload()` fires (page reloads).
5. Remove the temporary `throw` before committing.

- [ ] **Step 6: Commit**

```bash
git add components/shared/error-boundary.jsx app/_layout.jsx
git commit -m "feat(errors): add root ErrorBoundary with reload recovery"
```

---

### Task 4: Version bump + final whole-branch review

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: nothing new — this task only bumps the version field.

- [ ] **Step 1: Bump the version**

In `package.json`, change:

```json
  "version": "0.14.0",
```

to:

```json
  "version": "0.15.0",
```

Run `npm install` afterward so `package-lock.json`'s top-level `version`/`packages[""].version` fields stay in sync (no dependency changes in this branch, so the lockfile diff should be limited to those version fields).

- [ ] **Step 2: Run the full test suite and lint one last time**

Run: `npm test && npm run lint`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version for error and network handling (Subproyecto C)"
```

- [ ] **Step 4: Final whole-branch review**

Per `subagent-driven-development`, dispatch the final whole-branch code review on the most capable available model, regardless of cost preference — covering the full diff against `develop` across all 3 feature commits (Tasks 1-3) plus the version bump. Delete this plan's SDD workspace once the review is clean.

---

## Self-Review Notes

**Spec coverage:** §1 (timeout/AbortController) → Task 2. §2 (message mapping) → Task 1 (pure functions) + Task 2 (wiring). §3 (`ErrorBoundary`) → Task 3. Testing section → Tasks 1-2 (automated) + Task 3 (manual verification steps, matching project convention of no component render tests). "Archivos nuevos"/"Archivos modificados" from the spec are covered 1:1 across Tasks 1-4 — no spec file is left untouched by any task.

**Placeholder scan:** no TBD/TODO; every step has literal code or an exact command; no "similar to Task N" references — Task 2's diff blocks are written out in full even though they're adjacent to Task 1's output.

**Type/name consistency:** `mapNetworkError`/`mapHttpErrorMessage` signatures match between Task 1 (definition) and Task 2 (usage) exactly. `ErrorBoundary` is a named export in Task 3, imported by name (not default) in the same task's `app/_layout.jsx` edit — no mismatch between tasks.

# Light Theme Contrast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the light theme the same tonal depth the dark theme already has — a warm page background distinguishable from white cards/header, and opaque (not washed-out translucent) green tints for badges, avatars, and active-state highlights.

**Architecture:** Four new literal colors added to `tailwind.config.js` (`paper`, `primary-tint`, `primary-tint-subtle`, `on-primary-tint`). Every affected className gets its light-mode value swapped to the new token while gaining an explicit `dark:` override carrying the *old* value, so dark mode renders pixel-identical to today. No component logic changes — pure className edits.

**Tech Stack:** NativeWind (Tailwind for React Native), no new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-14-light-theme-contrast-design.md`.
- Dark theme must render identically before/after — every swapped class keeps its old value under an explicit `dark:` prefix.
- Do not touch: solid `bg-primary` buttons (no opacity suffix), danger-zone red, amber trainer-data sections, any `border-slate-*` class, form input backgrounds (`InputField`/`PickerField`/`SelectField`/`DateField` styling in `components/forms/fields.jsx` and the auth screens' local input ternaries).
- Only touch a `bg-slate-50` occurrence if it is the **outermost page-level container** (the `SafeAreaView`/`ScrollView`/root `View` wrapping the whole screen). Nested boxes/cards using `bg-slate-50` are explicitly out of scope per the spec (no new "card-2" tier is introduced).
- Tests must stay green: `npm test` → 32/32 baseline before this work, same 32 after (no new test files — this project has no component-render tests, visual changes are verified manually, matching existing convention).

---

### Task 1: Tailwind color tokens

**Files:**
- Modify: `tailwind.config.js`

**Interfaces:**
- Produces: four new Tailwind color utilities available project-wide as `bg-paper`, `bg-primary-tint`, `text-primary-tint` (etc. — full utility set NativeWind derives from a named color), `bg-primary-tint-subtle`, `bg-on-primary-tint`/`text-on-primary-tint`. Used by Tasks 2-6.

- [ ] **Step 1: Read the current colors block**

Run: `sed -n '1,15p' tailwind.config.js`
Expected:
```js
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './routes/**/*.{js,jsx}', './providers/**/*.{js,jsx}', './store/**/*.{js,jsx}', './services/**/*.{js,jsx}', './data/**/*.{js,jsx}', './utils/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#8cc63e',
        ink: '#0d1013',
        surface: '#111518',
        'surface-2': '#1d2125',
        'surface-3': '#282d31',
      },
```

- [ ] **Step 2: Add the four new tokens**

In `tailwind.config.js`, replace:

```js
      colors: {
        primary: '#8cc63e',
        ink: '#0d1013',
        surface: '#111518',
        'surface-2': '#1d2125',
        'surface-3': '#282d31',
      },
```

with:

```js
      colors: {
        primary: '#8cc63e',
        ink: '#0d1013',
        surface: '#111518',
        'surface-2': '#1d2125',
        'surface-3': '#282d31',
        paper: '#f3efe4',
        'primary-tint': '#dcec9e',
        'primary-tint-subtle': '#eef3dc',
        'on-primary-tint': '#3c6b12',
      },
```

- [ ] **Step 3: Restart the dev server and confirm the tokens resolve**

Start the web preview (`expo-web` launch config), navigate anywhere, and run in the browser console via `preview_eval`:

```js
(function(){
  const probe = document.createElement('div');
  probe.className = 'bg-paper';
  document.body.appendChild(probe);
  const bg = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return bg;
})()
```

Expected: `"rgb(243, 239, 228)"` (i.e. `#f3efe4`). If it returns transparent/empty, the dev server needs a full restart (NativeWind reads `tailwind.config.js` at bundle time, not hot-reloadable).

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: PASS, 32/32 (config-only change, no logic touched).

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js
git commit -m "feat(theme): add paper and opaque primary-tint color tokens"
```

---

### Task 2: Landing & home screens

**Files:**
- Modify: `components/home/home-landing-screen.jsx:11,25,28,70,90`
- Modify: `components/home/home-mobile-screen.jsx:10,31,89`
- Modify: `components/home/authenticated-home-screen.jsx:15,16`
- Modify: `app/+not-found.jsx:13,16`

**Interfaces:**
- Consumes: `bg-paper`, `bg-primary-tint`, `bg-primary-tint-subtle` from Task 1.

- [ ] **Step 1: `home-landing-screen.jsx` — page background**

Current line 25:
```jsx
    <ScrollView className="flex-1 bg-slate-50 dark:bg-[#0d1013]">
```

Replace with:
```jsx
    <ScrollView className="flex-1 bg-paper dark:bg-[#0d1013]">
```

- [ ] **Step 2: `home-landing-screen.jsx` — icon boxes and pills (two identical icon-box lines)**

Lines 11 and 90 are both exactly:
```jsx
      <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
```

Use `replace_all` for this exact string in this file — both occurrences get the identical change:
```jsx
      <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-primary-tint dark:bg-primary/15">
```

Line 28:
```jsx
          <View className="mb-6 flex-row items-center gap-2 self-center rounded-full bg-primary/20 px-4 py-2">
```
Replace with:
```jsx
          <View className="mb-6 flex-row items-center gap-2 self-center rounded-full bg-primary-tint dark:bg-primary/20 px-4 py-2">
```

Line 70:
```jsx
              <View className="mb-6 flex-row items-center gap-2 self-start rounded-full bg-primary/20 px-4 py-2">
```
Replace with:
```jsx
              <View className="mb-6 flex-row items-center gap-2 self-start rounded-full bg-primary-tint dark:bg-primary/20 px-4 py-2">
```

- [ ] **Step 3: `home-mobile-screen.jsx` — icon boxes and pills**

Line 10:
```jsx
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
```
Replace with:
```jsx
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-tint dark:bg-primary/15">
```

Line 31:
```jsx
        <View className="mb-6 flex-row items-center gap-2 rounded-full bg-primary/20 px-3 py-1.5">
```
Replace with:
```jsx
        <View className="mb-6 flex-row items-center gap-2 rounded-full bg-primary-tint dark:bg-primary/20 px-3 py-1.5">
```

Line 89:
```jsx
          <View className="mb-6 flex-row items-center gap-2 self-start rounded-full bg-primary/20 px-3 py-1.5">
```
Replace with:
```jsx
          <View className="mb-6 flex-row items-center gap-2 self-start rounded-full bg-primary-tint dark:bg-primary/20 px-3 py-1.5">
```

Do **not** touch line 88 (`bg-slate-50` hero card) or line 112 (`bg-slate-50` feature card) — both are nested cards, out of scope per Global Constraints.

- [ ] **Step 4: `authenticated-home-screen.jsx` — page background and avatar circle**

Line 15:
```jsx
    <View className="flex-1 items-center justify-center bg-slate-50 px-6 dark:bg-ink">
```
Replace with:
```jsx
    <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink">
```

Line 16:
```jsx
      <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-primary/15">
```
Replace with:
```jsx
      <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15">
```

- [ ] **Step 5: `app/+not-found.jsx` — page background and icon circle**

Line 13:
```jsx
    <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 px-6 dark:bg-ink" edges={['top', 'bottom']}>
```
Replace with:
```jsx
    <SafeAreaView className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" edges={['top', 'bottom']}>
```

Line 16:
```jsx
      <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-primary/15">
```
Replace with:
```jsx
      <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15">
```

- [ ] **Step 6: Run the test suite**

Run: `npm test`
Expected: PASS, 32/32.

- [ ] **Step 7: Manual verification (web preview)**

Load `/` (landing, logged out) and `/` (authenticated home, logged in) and a broken route (e.g. `/does-not-exist`) in light mode. Confirm: page background is warm off-white (not pure white/grey), the "Potenciado por IA" pill and feature icon boxes show visible opaque green (not a barely-there tint), header and white cards still read as a lighter step above the page. Switch to dark mode and confirm it looks unchanged from before this task.

- [ ] **Step 8: Commit**

```bash
git add components/home/home-landing-screen.jsx components/home/home-mobile-screen.jsx components/home/authenticated-home-screen.jsx "app/+not-found.jsx"
git commit -m "feat(theme): apply paper background and opaque tints to landing/home screens"
```

---

### Task 3: Auth screens

**Files:**
- Modify: `components/auth/login-screen.jsx:228`
- Modify: `components/auth/register-screen.jsx:205`
- Modify: `components/auth/forgot-password-form.jsx:28`

**Interfaces:**
- Consumes: `bg-paper`, `bg-primary-tint-subtle` from Task 1.

- [ ] **Step 1: `login-screen.jsx` — page background**

Current line 228:
```jsx
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-ink" edges={['top', 'bottom']}>
```
Replace with:
```jsx
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']}>
```

Do **not** touch lines 106 or 139 — both are `InputField`-style input backgrounds, not the page.

- [ ] **Step 2: `register-screen.jsx` — page background**

Current line 205:
```jsx
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-ink" edges={['top', 'bottom']}>
```
Replace with:
```jsx
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']}>
```

Do **not** touch line 471 (password-requirements box) — nested card, out of scope.

- [ ] **Step 3: `forgot-password-form.jsx` — confirmation icon circle**

Current line 28:
```jsx
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary/10">
```
Replace with:
```jsx
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary-tint-subtle dark:bg-primary/10">
```

Do **not** touch line 58 — input background ternary, not an icon/badge tint.

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: PASS, 32/32.

- [ ] **Step 5: Manual verification (web preview)**

Load `/login` and `/register` in light mode. Confirm the page background is the warm paper tone and the centered white form card pops against it. Confirm the input fields inside the card are unchanged (still their existing `bg-slate-50`/`bg-white` styling — this task doesn't touch them). On the login screen, trigger "¿Olvidaste tu contraseña?" and submit to reach the confirmation view — confirm the email-check icon circle shows a visible opaque green ring, not a near-invisible tint. Switch to dark mode, confirm unchanged.

- [ ] **Step 6: Commit**

```bash
git add components/auth/login-screen.jsx components/auth/register-screen.jsx components/auth/forgot-password-form.jsx
git commit -m "feat(theme): apply paper background and opaque tint to auth screens"
```

---

### Task 4: Profile screens

**Files:**
- Modify: `components/profile/profile-screen.jsx:23,71,89,190`
- Modify: `components/profile/edit-profile-screen.jsx:147`
- Modify: `components/profile/activate-trainer-screen.jsx:37`

**Interfaces:**
- Consumes: `bg-paper`, `bg-primary-tint`, `text-on-primary-tint` from Task 1.

- [ ] **Step 1: `profile-screen.jsx` — status badge, avatars, page background**

Current line 23:
```jsx
  active: { label: 'Activo', badge: 'bg-primary/15', text: 'text-primary' },
```
Replace with:
```jsx
  active: { label: 'Activo', badge: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
```

Current line 71:
```jsx
        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/15">
```
Replace with:
```jsx
        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15">
```

Current line 89:
```jsx
      <View className="mb-3 h-20 w-20 items-center justify-center rounded-full bg-primary/15">
```
Replace with:
```jsx
      <View className="mb-3 h-20 w-20 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15">
```

Current line 190:
```jsx
    <ScrollView className="flex-1 bg-slate-50 dark:bg-ink" contentContainerClassName="px-4 py-8">
```
Replace with:
```jsx
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8">
```

- [ ] **Step 2: `edit-profile-screen.jsx` — page background**

Current line 147:
```jsx
      className="flex-1 bg-slate-50 dark:bg-ink"
```
Replace with:
```jsx
      className="flex-1 bg-paper dark:bg-ink"
```

- [ ] **Step 3: `activate-trainer-screen.jsx` — page background**

Current line 37:
```jsx
      className="flex-1 bg-slate-50 dark:bg-ink"
```
Replace with:
```jsx
      className="flex-1 bg-paper dark:bg-ink"
```

Do **not** touch `deactivate-account-modal.jsx:45` — it's an input background, not a page.

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: PASS, 32/32.

- [ ] **Step 5: Manual verification (web preview)**

Log in, load `/profile`. Confirm: page background is the warm paper tone, "Activo" status badge and both avatar circles (web header layout and mobile-centered layout — resize viewport to check both) show opaque visible green, text on the "Activo" badge is dark green and legible. Load `/profile/edit` and `/profile/activate-trainer`, confirm page background matches. Switch to dark mode, confirm all of the above render unchanged from before this task.

- [ ] **Step 6: Commit**

```bash
git add components/profile/profile-screen.jsx components/profile/edit-profile-screen.jsx components/profile/activate-trainer-screen.jsx
git commit -m "feat(theme): apply paper background and opaque tints to profile screens"
```

---

### Task 5: Shell components (web/mobile shells, loading screen)

**Files:**
- Modify: `components/shell/app-web-shell.jsx:135,183,241`
- Modify: `components/shell/app-mobile-shell.jsx:144`
- Modify: `components/shell/app-loading-screen.jsx:11`

**Interfaces:**
- Consumes: `bg-paper`, `bg-primary-tint-subtle` from Task 1.

- [ ] **Step 1: `app-web-shell.jsx` — active tab, avatar, page background**

Current (lines 133-137):
```jsx
                  className={`flex-row items-center gap-1.5 rounded-lg px-3 py-1.5 ${
                    isActive
                      ? 'bg-primary/10'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800'
                  }`}
```
Replace with:
```jsx
                  className={`flex-row items-center gap-1.5 rounded-lg px-3 py-1.5 ${
                    isActive
                      ? 'bg-primary-tint-subtle dark:bg-primary/10'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800'
                  }`}
```

Current line 183:
```jsx
            <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
```
Replace with:
```jsx
            <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-tint-subtle dark:bg-primary/10">
```

Current line 241:
```jsx
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-ink" edges={['top', 'bottom']}>
```
Replace with:
```jsx
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']}>
```

Do **not** touch line 73 (`active:bg-slate-50` hover/press state on a dropdown menu item) — it's an interaction state, not a static background, out of scope.

- [ ] **Step 2: `app-mobile-shell.jsx` — active route highlight**

Current line 144:
```jsx
                        isActive ? 'border-l-4 border-primary bg-primary/10' : ''
```
Replace with:
```jsx
                        isActive ? 'border-l-4 border-primary bg-primary-tint-subtle dark:bg-primary/10' : ''
```

- [ ] **Step 3: `app-loading-screen.jsx` — page background**

Current line 11:
```jsx
    <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-ink">
```
Replace with:
```jsx
    <View className="flex-1 items-center justify-center bg-paper dark:bg-ink">
```

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: PASS, 32/32.

- [ ] **Step 5: Manual verification (web preview)**

Desktop viewport: confirm the active top-nav tab and the TopBar user avatar show a subtle opaque green (lighter than the badges from Task 4, per the `/10` vs `/15` weight distinction). Mobile viewport: open the sidebar drawer, navigate to a route, confirm the active route row shows the same subtle opaque green with its left border. Reload during the loading-screen flash (throttle network if needed) to see the paper background there too. Switch to dark mode, confirm unchanged.

- [ ] **Step 6: Commit**

```bash
git add components/shell/app-web-shell.jsx components/shell/app-mobile-shell.jsx components/shell/app-loading-screen.jsx
git commit -m "feat(theme): apply opaque tints to shell nav highlights and paper to loading screen"
```

---

### Task 6: Shared role/badge/toast/picker components

**Files:**
- Modify: `components/shell/role-badge.jsx:4`
- Modify: `components/shell/role-management-section.jsx:10`
- Modify: `components/feedback/paceron-toast.jsx:9`
- Modify: `components/forms/fields.jsx:284,287`

**Interfaces:**
- Consumes: `bg-primary-tint`, `bg-primary-tint-subtle`, `text-on-primary-tint` from Task 1.

- [ ] **Step 1: `role-badge.jsx` — runner badge style**

Current line 4:
```jsx
  runner: { bg: 'bg-primary/15', text: 'text-primary', label: 'Corredor' },
```
Replace with:
```jsx
  runner: { bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary', label: 'Corredor' },
```

- [ ] **Step 2: `role-management-section.jsx` — runner action-row style**

Current line 10:
```jsx
  runner: { bg: 'bg-primary/15', text: 'text-primary', icon: '#8cc63e' },
```
Replace with:
```jsx
  runner: { bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary', icon: '#8cc63e' },
```

Leave `icon: '#8cc63e'` untouched — it's a literal hex passed to `MaterialCommunityIcons`, not a Tailwind class, and icon colors are out of scope per the spec (only backgrounds and their paired text change).

- [ ] **Step 3: `paceron-toast.jsx` — success toast tint**

Current line 9:
```jsx
  success: { icon: 'check-circle', accent: '#8cc63e', tint: 'bg-primary/15' },
```
Replace with:
```jsx
  success: { icon: 'check-circle', accent: '#8cc63e', tint: 'bg-primary-tint dark:bg-primary/15' },
```

- [ ] **Step 4: `fields.jsx` — `PickerField` selected-item highlight**

Current (lines 280-290):
```jsx
                  return (
                    <Pressable
                      key={item.id}
                      className={`flex-row items-center gap-3 border-b border-slate-100 px-5 py-3.5 active:opacity-70 dark:border-slate-800 ${
                        isSelected ? 'bg-primary/10' : ''
                      }`}
                      onPress={() => { onChange(item.id); setVisible(false); }}
                    >
                      <Text className={`flex-1 text-sm ${
                        isSelected ? 'font-semibold text-primary' : 'text-slate-700 dark:text-slate-200'
                      }`}>
```
Replace with:
```jsx
                  return (
                    <Pressable
                      key={item.id}
                      className={`flex-row items-center gap-3 border-b border-slate-100 px-5 py-3.5 active:opacity-70 dark:border-slate-800 ${
                        isSelected ? 'bg-primary-tint-subtle dark:bg-primary/10' : ''
                      }`}
                      onPress={() => { onChange(item.id); setVisible(false); }}
                    >
                      <Text className={`flex-1 text-sm ${
                        isSelected ? 'font-semibold text-on-primary-tint dark:text-primary' : 'text-slate-700 dark:text-slate-200'
                      }`}>
```

- [ ] **Step 5: Run the test suite**

Run: `npm test`
Expected: PASS, 32/32.

- [ ] **Step 6: Manual verification (web preview)**

Confirm the "Corredor" role badge (visible in the TopBar pill, the Profile "Roles" card, and the dropdown/sidebar switch-role pill) shows opaque green with dark-green legible text in light mode. Trigger a success toast (e.g. save profile edits) and confirm its tint is opaque, not washed out. On mobile viewport, open a `PickerField` (e.g. País/Provincia/Localidad in Register or Edit) and confirm the currently-selected row shows a visible opaque green highlight with dark-green bold text. Switch to dark mode, confirm all of the above are unchanged from before this task.

- [ ] **Step 7: Commit**

```bash
git add components/shell/role-badge.jsx components/shell/role-management-section.jsx components/feedback/paceron-toast.jsx components/forms/fields.jsx
git commit -m "feat(theme): apply opaque tint to role badges, success toast, and picker selection"
```

---

## Manual verification (after all tasks)

- [ ] Full light-mode pass across every screen touched in Tasks 2-6: landing, authenticated home, 404, login, register, profile, edit profile, activate trainer, web dropdown, mobile sidebar, loading screen, a success toast. Page backgrounds read as a warm paper tone distinguishable from white header/cards; every green badge/avatar/highlight is opaque and legible, none look washed-out or invisible.
- [ ] Full dark-mode pass across the same screens — pixel-identical to before this plan (spot-check a few with browser devtools if in doubt).
- [ ] `npm test` → 32/32 after all 6 tasks.

## Notes / follow-ups (out of scope)

- Borders (`border-slate-*`) were intentionally left untouched — a future pass could warm them to match `paper`, but that's a separate decision or a separate spec.
- Within `components/auth/forgot-password-form.jsx` and `components/forms/fields.jsx`, only the icon-circle/selected-item tints (Task 3 Step 3, Task 6 Step 4) were in scope — every other `bg-slate-50` occurrence in those two files (input-field backgrounds) is explicitly out of scope and untouched.
- `components/home/home-mobile-screen.jsx:88,112` (`bg-slate-50` nested cards) and `components/auth/register-screen.jsx:471` / `components/profile/deactivate-account-modal.jsx:45` (nested boxes) were also audited and intentionally left as-is.

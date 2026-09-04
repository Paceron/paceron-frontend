# Módulo de settings de usuario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pantalla `Settings` nueva con 2 secciones — tema predeterminado (sincronizado entre dispositivos, semilla solo para dispositivos sin valor local propio) y permitir/no invitaciones a equipos — más el punto de entrada en el dropdown/drawers del shell.

**Architecture:** `store/auth-store.js#toUserModel`/`toUpdatePayload` ganan los 2 campos nuevos (`default_theme`/`allow_team_invitations`, ya reales en el backend, mismo PUT de perfil que ya usa `updateUser`). `providers/theme-provider.jsx` gana `seedDefaultTheme()`, llamado desde `login`/`hydrate` del store — aplica el default sincronizado solo si el dispositivo todavía no tiene ningún valor local guardado. Pantalla nueva `components/settings/settings-screen.jsx` con 2 `SectionCard`, cada campo autoguarda al cambiar (sin botón "Guardar" — mismo espíritu que el toggle de tema ya existente). Entrada nueva en `app-web-shell.jsx`/`app-web-shell-narrow.jsx`/`app-mobile-shell.jsx`, mismo molde que la fila "Ver perfil" ya existente.

**Tech Stack:** React Native / Expo, Zustand (`auth-store.js`), `services/storage.js` (persistencia nativa ya usada por el bugfix previo de esta rama).

**Spec:** `docs/superpowers/specs/2026-09-04-user-settings-design.md`

## Global Constraints

- Backend ya confirmado real (swagger verificado 2026-09-04): `default_theme` (string) y `allow_team_invitations` (bool) están en `UserUpdateRequest`/`UserResponse` — mismo `PUT /users/{id}` que ya usa `services/user.js#updateUser`, **sin endpoint nuevo**.
- El toggle rápido existente (`ThemeToggle`) sigue siendo 100% local — nunca debe llamar a `updateUser` ni tocar `default_theme`.
- El default sincronizado se aplica **solo como semilla**: únicamente si el dispositivo no tiene todavía ningún valor en su storage local (`services/storage.js`/`localStorage`, key `paceron-theme-mode`). Un dispositivo que ya tiene su propio valor nunca se pisa por un cambio de default hecho desde otro dispositivo.
- Cambiar "Tema predeterminado" desde la pantalla de Settings sí aplica también al dispositivo actual en el momento.
- `allow_team_invitations` default `true` del lado backend — no romper cuentas existentes.
- Todo `View`/`Text`/`Pressable`/etc. nuevo lleva `nativeID`+`testID` únicos (regla `local/require-native-id`, sin excepción).
- Sin tests de render de componentes/hooks (convención del repo) — la pantalla y las filas del shell se verifican manualmente.

---

### Task 1: Normalizers — `defaultTheme`/`allowTeamInvitations`

**Files:**
- Modify: `services/normalizers.js` (`toUserModel`, `toUpdatePayload`)
- Test: `__tests__/normalizers.test.js`

**Interfaces:**
- Consumes: nada de otras tasks.
- Produces: `toUserModel(dto)` incluye `defaultTheme`/`allowTeamInvitations`; `toUpdatePayload(form)` acepta `form.defaultTheme`/`form.allowTeamInvitations` opcionales → `default_theme`/`allow_team_invitations` en el payload. Task 2 y Task 3 consumen estos 2 campos por sus nombres exactos.

- [ ] **Step 1: Escribir los tests (fallan)**

En `__tests__/normalizers.test.js`, dentro del `describe('toUserModel', ...)` ya existente, agregar:

```javascript
  test('maps default_theme and allow_team_invitations', () => {
    const dto = { user_id: 1, name: 'A', surname: 'B', default_theme: 'light', allow_team_invitations: false };
    const model = toUserModel(dto);
    expect(model.defaultTheme).toBe('light');
    expect(model.allowTeamInvitations).toBe(false);
  });

  test('defaults allowTeamInvitations to true when absent', () => {
    const dto = { user_id: 1, name: 'A', surname: 'B' };
    expect(toUserModel(dto).allowTeamInvitations).toBe(true);
  });
```

Dentro del `describe('toUpdatePayload', ...)` ya existente (si no existe un describe para esta función, buscar dónde están sus tests actuales — está probado junto al resto de `toUserModel`/payload builders en el mismo archivo), agregar:

```javascript
describe('toUpdatePayload — default_theme / allow_team_invitations', () => {
  const BASE_FORM = { firstName: 'A', lastName: 'B', dni: '1', birthDate: '01/01/2000', email: 'a@b.com' };

  test('incluye default_theme cuando viene', () => {
    const payload = toUpdatePayload({ ...BASE_FORM, defaultTheme: 'light' });
    expect(payload.default_theme).toBe('light');
  });

  test('omite default_theme si no viene', () => {
    const payload = toUpdatePayload(BASE_FORM);
    expect(payload.default_theme).toBeUndefined();
  });

  test('incluye allow_team_invitations cuando viene (incluso false)', () => {
    const payload = toUpdatePayload({ ...BASE_FORM, allowTeamInvitations: false });
    expect(payload.allow_team_invitations).toBe(false);
  });

  test('omite allow_team_invitations si es undefined', () => {
    const payload = toUpdatePayload(BASE_FORM);
    expect(payload.allow_team_invitations).toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr los tests, confirmar que fallan**

Run: `npm test -- normalizers.test.js`
Expected: FAIL — `defaultTheme`/`allowTeamInvitations` son `undefined` en vez de los valores esperados.

- [ ] **Step 3: Extender `toUserModel` en `services/normalizers.js`**

Ubicar `toUserModel` (líneas 9-29) y agregar las 2 líneas nuevas antes del cierre del objeto:

```javascript
export function toUserModel(dto) {
  if (!dto) return null;
  return {
    userId: dto.user_id,
    name: dto.name,
    surname: dto.surname,
    email: dto.email,
    dni: dto.dni,
    birthDate: dto.birth_date,
    status: dto.status,
    city: dto.city,
    country: dto.country,
    phone: dto.phone,
    phoneContact: dto.phone_contact,
    province: dto.province,
    street: dto.street,
    number: dto.number,
    bankAlias: dto.bank_alias,
    photoUrl: dto.photo_url ?? null,
    defaultTheme: dto.default_theme ?? null,
    allowTeamInvitations: dto.allow_team_invitations ?? true,
  };
}
```

- [ ] **Step 4: Extender `toUpdatePayload`**

Ubicar `toUpdatePayload` (línea 60) y agregar el bloque condicional al final, antes del `return payload;`:

```javascript
export function toUpdatePayload(form) {
  const payload = {
    name: form.firstName,
    surname: form.lastName,
    email: form.email,
    dni: form.dni,
    birth_date: toBackendDate(form.birthDate),
    city: form.city ?? '',
    country: form.country ?? '',
    number: form.number ?? '',
    phone: form.phone ?? '',
    phone_contact: form.phoneContact ?? '',
    province: form.province ?? '',
    street: form.street ?? '',
    bank_alias: form.bankAlias ?? '',
  };
  if (form.defaultTheme !== undefined) payload.default_theme = form.defaultTheme;
  if (form.allowTeamInvitations !== undefined) payload.allow_team_invitations = form.allowTeamInvitations;
  return payload;
}
```

(El resto del cuerpo de la función es el existente — este step solo agrega las 2 líneas condicionales antes del `return`. No cambiar nada de lo demás.)

- [ ] **Step 5: Correr los tests, confirmar que pasan**

Run: `npm test -- normalizers.test.js`
Expected: PASS, todos los tests (viejos y nuevos).

- [ ] **Step 6: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / limpio.

- [ ] **Step 7: Commit**

```bash
git add services/normalizers.js __tests__/normalizers.test.js
git commit -m "feat(settings): add defaultTheme/allowTeamInvitations to user normalizers"
```

---

### Task 2: Semilla de tema — `seedDefaultTheme` + wiring en auth-store

**Files:**
- Modify: `providers/theme-provider.jsx` (nuevo export `seedDefaultTheme`)
- Modify: `store/auth-store.js` (`login`, `hydrate` llaman a `seedDefaultTheme` tras setear `user`)

**Interfaces:**
- Consumes: `defaultTheme` de `toUserModel` (Task 1) — `user.defaultTheme`.
- Produces: `seedDefaultTheme(defaultTheme: string | null): Promise<void>` exportado de `theme-provider.jsx`. No lo consume ninguna task posterior directamente (Task 3 no lo llama — la pantalla de Settings aplica el tema elegido con `setThemeMode`, ya existente, no con esta función de semilla).

Sin test dedicado (no hay tests de hooks/providers en el repo — ver `use-team-roster.js`, tampoco tiene). Se verifica manualmente (Step 6).

- [ ] **Step 1: Agregar `seedDefaultTheme` a `providers/theme-provider.jsx`**

Agregar esta función nueva, después de `persistNative` y antes de `export function ThemeProvider`:

```javascript
// Aplica el tema predeterminado sincronizado (Settings) — pero SOLO si este
// dispositivo todavía no tiene ningún valor propio guardado. Se llama desde
// auth-store tras login/hydrate, nunca desde el toggle rápido (ese sigue
// siendo 100% local, ver theme-toggle.jsx). Una vez aplicado acá, el
// dispositivo ya tiene su propio valor persistido — un cambio posterior del
// default desde otro dispositivo no vuelve a pisarlo.
export async function seedDefaultTheme(defaultTheme) {
  if (!defaultTheme) return;
  const mode = defaultTheme === 'light' ? 'light' : 'dark';

  if (isWeb) {
    if (typeof window === 'undefined' || window.localStorage.getItem(STORAGE_KEY)) return;
    colorScheme.set(mode);
    applyWebClass(mode);
    applyNativeRootBackground(mode);
    return;
  }

  const existing = await getItem(STORAGE_KEY);
  if (existing) return;
  colorScheme.set(mode);
  applyNativeRootBackground(mode);
  persistNative(mode);
}
```

- [ ] **Step 2: Agregar el import en `store/auth-store.js`**

Al principio del archivo, junto a los demás imports (después de la línea `import { getItem, setItem, removeItem } from './services/storage.js';` o equivalente cerca del tope del archivo), agregar:

```javascript
import { seedDefaultTheme } from '../providers/theme-provider.jsx';
```

- [ ] **Step 3: Llamar `seedDefaultTheme` desde `login` (líneas 61-79 de `store/auth-store.js`)**

El código actual de `login` es:

```javascript
  login: async (email, password) => {
    try {
      const result = await loginService(email, password);
      const token = result?.access_token;
      const user = toUserModel(result?.user);
      if (token && user) {
        const expiresAt = result.expires_in ? Date.now() + result.expires_in * 1000 : null;
        const session = { user, token, refreshToken: result.refresh_token ?? null, expiresAt };
        set(session);
        const { activeRole } = get();
        await persist({ ...session, activeRole, roles: [] });
        await get().fetchPermissions();
        return { success: true };
      }
      return { success: false, error: 'Credenciales incorrectas.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

Agregar una línea `seedDefaultTheme(user.defaultTheme);` justo después de `set(session);`:

```javascript
        set(session);
        seedDefaultTheme(user.defaultTheme);
        const { activeRole } = get();
```

Sin `await` — es fire-and-forget, no debe bloquear el resto del flujo de login.

- [ ] **Step 4: Llamar `seedDefaultTheme` desde `hydrate` (líneas 36-59 de `store/auth-store.js`)**

El código actual de `hydrate` es:

```javascript
  hydrate: async () => {
    try {
      const raw = await getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          user: data.user ?? null,
          token: data.token ?? null,
          refreshToken: data.refreshToken ?? null,
          expiresAt: data.expiresAt ?? null,
          activeRole: data.activeRole ?? 'runner',
          roles: Array.isArray(data.roles) ? data.roles : [],
        });
      }
    } catch {
      // sesión corrupta — se ignora y se arranca sin sesión
    }
    set({ hydrated: true });
    const { user, token } = get();
    if (user?.userId && token) await get().fetchPermissions();
  },
```

Agregar `seedDefaultTheme(user?.defaultTheme);` justo después de `const { user, token } = get();`:

```javascript
    set({ hydrated: true });
    const { user, token } = get();
    seedDefaultTheme(user?.defaultTheme);
    if (user?.userId && token) await get().fetchPermissions();
```

`user?.defaultTheme` cubre tanto el caso sin sesión persistida (`user` es `null`, `seedDefaultTheme(undefined)` es no-op por el `if (!defaultTheme) return;`) como una sesión vieja persistida antes de que este campo existiera (mismo resultado, no-op seguro).

- [ ] **Step 5: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / limpio — los tests existentes de `auth-store.js` no deberían romperse (la llamada nueva es fire-and-forget, no cambia ningún valor de retorno ni el shape del estado).

- [ ] **Step 6: Commit**

```bash
git add providers/theme-provider.jsx store/auth-store.js
git commit -m "feat(settings): seed synced default theme on login/hydrate (device without local value only)"
```

- [ ] **Step 7: Verificación manual**

Con `EXPO_PUBLIC_USE_MOCKS=true`: no aplica todavía (el mock de auth no devuelve `default_theme` — se prueba de punta a punta recién en Task 3, cuando la pantalla de Settings pueda escribirlo). Este task se verifica leyendo el código: confirmar que `seedDefaultTheme` nunca se llama desde `theme-toggle.jsx` (grep `seedDefaultTheme` no debe aparecer ahí).

---

### Task 3: Pantalla de Settings

**Files:**
- Create: `components/settings/settings-screen.jsx`
- Create: `app/(tabs)/settings.jsx`

**Interfaces:**
- Consumes: `useAuthStore` (`user`, `updateUser`), `useThemeMode` de `providers/theme-provider.jsx` (`setThemeMode`), `toUpdatePayload` (Task 1), `SectionCard`, `PickerField`/`SelectField` de `components/forms/fields.jsx`, `RequireAuth` de `components/guards/require-auth.jsx`.
- Produces: `SettingsScreen` — Task 4 (entrada en el shell) navega a `router.push('/settings')`.

Sin test dedicado (pantalla, sin tests de render — convención del repo). Verificación manual al final (Step 4).

- [ ] **Step 1: Crear `components/settings/settings-screen.jsx`**

```javascript
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { toUpdatePayload } from '../../services/normalizers.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SelectField, PickerField } from '../forms/fields.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

const THEME_OPTIONS = [
  { id: 'light', name: 'Claro' },
  { id: 'dark', name: 'Oscuro' },
];

// Construye el payload completo de PUT /users/{id} a partir del user actual
// del store + el campo puntual que cambió — el backend no soporta PATCH
// parcial acá, toUpdatePayload siempre espera el form completo (mismo
// criterio que edit-profile-screen.jsx).
function buildFullPayload(user, overrides) {
  return toUpdatePayload({
    firstName: user.name,
    lastName: user.surname,
    dni: user.dni,
    birthDate: user.birthDate,
    email: user.email,
    phone: user.phone,
    phoneContact: user.phoneContact,
    country: user.country,
    province: user.province,
    city: user.city,
    street: user.street,
    number: user.number,
    bankAlias: user.bankAlias,
    defaultTheme: user.defaultTheme,
    allowTeamInvitations: user.allowTeamInvitations,
    ...overrides,
  });
}

function SettingsScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { setThemeMode } = useThemeMode();

  const [savingTheme, setSavingTheme] = useState(false);
  const [savingInvitations, setSavingInvitations] = useState(false);

  const handleThemeChange = async (mode) => {
    setSavingTheme(true);
    const result = await updateUser(user.userId, buildFullPayload(user, { defaultTheme: mode }));
    setSavingTheme(false);
    if (result.success) {
      setThemeMode(mode);
    } else {
      Toast.show({ type: 'error', text1: 'No pudimos guardar el tema', text2: result.error });
    }
  };

  const handleInvitationsToggle = async () => {
    const next = !user.allowTeamInvitations;
    setSavingInvitations(true);
    const result = await updateUser(user.userId, buildFullPayload(user, { allowTeamInvitations: next }));
    setSavingInvitations(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos guardar el cambio', text2: result.error });
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="settings-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="settings-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="settings-screen-container" testID="settings-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="settings-screen-header" testID="settings-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="settings-screen-back-button"
            onPress={() => router.back()}
            testID="settings-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="settings-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="settings-screen-title">
            Settings
          </Text>
        </View>

        <SectionCard icon="palette-outline" title="Apariencia">
          <View className="flex-row items-center gap-3" nativeID="settings-screen-theme-row" testID="settings-screen-theme-row">
            <View className="flex-1" nativeID="settings-screen-theme-picker-wrap" testID="settings-screen-theme-picker-wrap">
              {isWeb ? (
                <SelectField
                  dense
                  hideErrorRow
                  label="Tema predeterminado"
                  onChange={handleThemeChange}
                  options={THEME_OPTIONS}
                  value={user.defaultTheme ?? 'dark'}
                />
              ) : (
                <PickerField
                  dense
                  hideErrorRow
                  label="Tema predeterminado"
                  onChange={handleThemeChange}
                  options={THEME_OPTIONS}
                  value={user.defaultTheme ?? 'dark'}
                />
              )}
            </View>
            {savingTheme && <ActivityIndicator color={colors.primary} size="small" />}
          </View>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="settings-screen-theme-hint" testID="settings-screen-theme-hint">
            Se aplica en este dispositivo ahora y queda guardado para cuando ingreses desde uno nuevo. No afecta el tema ya elegido en tus otros dispositivos.
          </Text>
        </SectionCard>

        <SectionCard icon="bell-outline" title="Notificaciones">
          <Pressable
            accessibilityLabel="Permitir invitaciones a equipos"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: user.allowTeamInvitations }}
            className="flex-row items-start gap-3 py-1"
            disabled={savingInvitations}
            nativeID="settings-screen-invitations-checkbox"
            onPress={handleInvitationsToggle}
            testID="settings-screen-invitations-checkbox"
          >
            <View
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${user.allowTeamInvitations ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}`}
              nativeID="settings-screen-invitations-checkbox-box"
              testID="settings-screen-invitations-checkbox-box"
            >
              {savingInvitations ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                user.allowTeamInvitations && <MaterialCommunityIcons color={colors.onPrimary} name="check-bold" size={14} />
              )}
            </View>
            <View className="flex-1" nativeID="settings-screen-invitations-checkbox-text" testID="settings-screen-invitations-checkbox-text">
              <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID="settings-screen-invitations-checkbox-label" testID="settings-screen-invitations-checkbox-label">
                Permitir invitaciones a equipos
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="settings-screen-invitations-checkbox-hint" testID="settings-screen-invitations-checkbox-hint">
                Si lo desactivás, los entrenadores no van a poder invitarte a un equipo.
              </Text>
            </View>
          </Pressable>
        </SectionCard>
      </View>
    </ScrollView>
  );
}

export function SettingsScreen() {
  return (
    <RequireAuth>
      <SettingsScreenContent />
    </RequireAuth>
  );
}
```

- [ ] **Step 2: Crear la ruta `app/(tabs)/settings.jsx`**

```javascript
import { SettingsScreen } from '../../components/settings/settings-screen.jsx';

export default function Settings() {
  return <SettingsScreen />;
}
```

- [ ] **Step 3: Correr tests y lint**

Run: `npm test && npm run lint`
Expected: PASS / limpio.

- [ ] **Step 4: Commit**

```bash
git add components/settings/settings-screen.jsx app/\(tabs\)/settings.jsx
git commit -m "feat(settings): add Settings screen (default theme + team invitations toggle)"
```

- [ ] **Step 5: Verificación manual**

Con `EXPO_PUBLIC_USE_MOCKS=true`: entrar a `/settings` (tipeando la URL, todavía sin entrada en el shell — eso es Task 4), cambiar "Tema predeterminado" a Claro, confirmar que el tema del dispositivo actual cambia en el momento. Tocar el checkbox de invitaciones, confirmar que cambia de estado. Recargar la pantalla — como el mock de `updateUser` sí persiste en memoria durante la sesión (mismo patrón que el resto de mocks del repo), el valor debería mantenerse hasta un reload completo del bundle.

---

### Task 4: Entrada a Settings — dropdown y drawers

**Files:**
- Modify: `components/shell/app-web-shell.jsx`
- Modify: `components/shell/app-web-shell-narrow.jsx`
- Modify: `components/shell/app-mobile-shell.jsx`

**Interfaces:**
- Consumes: nada de otras tasks (navega a `/settings`, ruta ya creada en Task 3).
- Produces: nada — último punto de integración visible.

- [ ] **Step 1: `app-web-shell.jsx` — fila en el dropdown**

En `DropdownMenu` (dentro de `components/shell/app-web-shell.jsx`), ubicar el bloque `Pressable` con `nativeID="web-shell-dropdown-profile-link"` (fila "Ver perfil"). Justo después de ese `Pressable` y ANTES del `View` divisor que le sigue (`nativeID="web-shell-dropdown-divider-profile"`), insertar una fila nueva idéntica en estructura, más un divisor propio:

```javascript
        <View className="mx-4 border-t border-slate-100 dark:border-slate-800" nativeID="web-shell-dropdown-divider-settings-above" testID="web-shell-dropdown-divider-settings-above" />

        <Pressable
          className="flex-row items-center gap-3 px-4 py-3.5 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors duration-150"
          nativeID="web-shell-dropdown-settings-link"
          onPress={() => { router.push('/settings'); onClose(); }}
          testID="web-shell-dropdown-settings-link"
        >
          <MaterialCommunityIcons name="cog-outline" size={18} color={colors.onSurfaceVariant} />
          <Text className="flex-1 text-sm font-medium text-slate-900 dark:text-white" nativeID="web-shell-dropdown-settings-link-label" testID="web-shell-dropdown-settings-link-label">Settings</Text>
        </Pressable>
```

(El divisor que ya existía después de "Ver perfil", `web-shell-dropdown-divider-profile`, queda igual — ahora separa "Settings" de "Cerrar sesión" en vez de separar "Ver perfil" de "Cerrar sesión". El nuevo `web-shell-dropdown-divider-settings-above` separa "Ver perfil" de "Settings".)

- [ ] **Step 2: `app-web-shell-narrow.jsx` — fila en el drawer**

Ubicar el `Pressable` con `nativeID="web-narrow-drawer-profile-row"`. Justo después de su cierre (`</Pressable>`), agregar una fila nueva con la misma estructura visual que esa (icono + texto, sin avatar):

```javascript
              <Pressable
                className="flex-row items-center gap-3 border-b border-slate-200 px-5 py-4 hover:bg-slate-100 active:opacity-70 dark:border-slate-800 dark:hover:bg-slate-800"
                nativeID="web-narrow-drawer-settings-row"
                onPress={() => goTo('/settings')}
                testID="web-narrow-drawer-settings-row"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800" nativeID="web-narrow-drawer-settings-icon" testID="web-narrow-drawer-settings-icon">
                  <MaterialCommunityIcons color={colors.primary} name="cog-outline" size={20} />
                </View>
                <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID="web-narrow-drawer-settings-label" testID="web-narrow-drawer-settings-label">Settings</Text>
              </Pressable>
```

`goTo` ya es la función existente en ese archivo que hace `router.push(href); onClose();` (la misma que usa el resto de filas del drawer) — no crear una nueva.

- [ ] **Step 3: `app-mobile-shell.jsx` — fila en el drawer**

Mismo cambio que el Step 2, en `components/shell/app-mobile-shell.jsx`, ubicando el `Pressable` `nativeID="mobile-drawer-profile-row"` y agregando la fila equivalente después, con prefijo `mobile-drawer-settings-*` en vez de `web-narrow-drawer-settings-*`.

- [ ] **Step 4: Correr tests y lint**

Run: `npm test && npm run lint`
Expected: PASS / limpio.

- [ ] **Step 5: Commit**

```bash
git add components/shell/app-web-shell.jsx components/shell/app-web-shell-narrow.jsx components/shell/app-mobile-shell.jsx
git commit -m "feat(settings): add Settings entry point to shell dropdown/drawers"
```

- [ ] **Step 6: Verificación manual**

Con `EXPO_PUBLIC_USE_MOCKS=true`, web ancho: abrir el dropdown del user, confirmar que aparece "Settings" entre "Ver perfil" y "Cerrar sesión", click navega a `/settings`. Web angosto (<1024px): abrir el drawer (hamburguesa), confirmar la fila "Settings" debajo del perfil.

---

### Task 5: Version bump + cierre de rama

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: nada.
- Produces: nada — último task.

- [ ] **Step 1: Bump de versión**

`package.json` tiene hoy `"version": "0.8.0"`. Cambiar a `"version": "0.9.0"` (bump menor — pantalla nueva + 2 settings reales contra backend confirmado, no un fix chico). En `package-lock.json`, cambiar únicamente las 2 ocurrencias de `"version": "0.8.0"` en las primeras 10 líneas del archivo (raíz del paquete `paceron-frontend`) — no tocar ninguna otra ocurrencia de esa versión perteneciente a una dependencia de terceros. Nunca correr `npm install` para esto.

- [ ] **Step 2: Correr toda la suite una vez más**

Run: `npm test && npm run lint`
Expected: PASS / limpio.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version to 0.9.0"
```

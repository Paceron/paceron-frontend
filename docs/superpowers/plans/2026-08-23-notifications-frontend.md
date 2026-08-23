# Notificaciones push (Android) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la app reciba notificaciones push (Android) para los 5 triggers que ya dispara el backend, mostrándolas como `Toast` con la app abierta y navegando a la pantalla correspondiente al tocarlas con la app cerrada/en background.

**Architecture:** Capa de servicio (`services/notifications.js`) que registra el token de push contra `POST /api/v1/push-tokens` — mismo patrón que el resto de `services/`. Un hook (`hooks/use-push-notifications.js`) que pide permiso tras el login, obtiene el token con `expo-notifications`, lo registra, y cablea los listeners de foreground/tap. Se monta una sola vez en `app/_layout.jsx`.

**Tech Stack:** `expo-notifications` (nuevo), `expo-constants` (ya instalado, para leer el `projectId` de EAS), `react-native-toast-message` (ya instalado, reutilizado para el foreground), Expo Router (`useRouter`) para el tap-to-navigate.

## Global Constraints

- Android-only — no se agrega nada de iOS ni de permisos de iOS en esta iteración.
- Sin pantalla de preferencias por categoría — un solo permiso general del sistema operativo.
- El endpoint real, confirmado contra el swagger de backend (rama `develop`): `POST /api/v1/push-tokens`, body `{ "token": string, "platform": "android" }`, self-only (el `user_id` sale del JWT, no se manda), respuesta `{ "message": string }`. Sin `security` declarado en swagger — mismo patrón que el resto de la API, el `Authorization: Bearer` ya lo agrega `services/api.js` automáticamente.
- Upsert por `token`, no por `user_id` — no hace falta ningún endpoint ni llamada de "desvincular" en logout.
- Con la app abierta (foreground), la notificación se muestra como `Toast` (`type: 'info'`, ya definido en `components/feedback/paceron-toast.jsx`), nunca como banner nativo del sistema.
- Al tocar una notificación, se navega a `data.route` tal cual la manda el backend — el frontend no mapea `type` → ruta localmente.
- No es probable en Expo Go — requiere build de desarrollo (EAS). El emulador Android ya configurado en el proyecto (Pixel_9 AVD) alcanza para probar.
- Spec completo: `docs/superpowers/specs/2026-08-16-notifications-design.md`. Contrato de backend: `docs/BACKEND_NOTIFICATIONS_REQUIREMENTS.md`.

---

### Task 1: Servicio de registro de push token

**Files:**
- Create: `services/notifications.js`
- Create: `services/__mocks__/notifications-mock.js`
- Create: `__tests__/notifications-mock.test.js`

**Interfaces:**
- Produces: `registerPushToken(token, platform)` desde `services/notifications.js` — usada por `hooks/use-push-notifications.js` en Task 2. Devuelve `{ message: string }` en éxito, lanza `Error` con `.status` en fallo (mismo contrato que el resto de `services/`).

- [ ] **Step 1: Escribir el mock**

```js
// services/__mocks__/notifications-mock.js
// Simula POST /api/v1/push-tokens para EXPO_PUBLIC_USE_MOCKS=true. Upsert
// por token real es responsabilidad del backend — acá solo se valida que
// vengan los dos campos requeridos, igual que hace el backend real
// (pushtoken.RegisterPushTokenRequest, ambos campos "required").
export async function mockRegisterPushToken(token, platform) {
  if (!token || !platform) {
    const error = new Error('token y platform son requeridos.');
    error.status = 400;
    throw error;
  }
  return { message: 'Token registrado correctamente.' };
}
```

- [ ] **Step 2: Escribir el servicio**

```js
// services/notifications.js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockRegisterPushToken } from './__mocks__/notifications-mock.js';

// POST /api/v1/push-tokens — self-only (el user_id sale del JWT). Upsert
// por token: re-registrar el mismo token con otra sesión reasigna el
// dueño solo, no hace falta desvincular en logout (ver
// docs/BACKEND_NOTIFICATIONS_REQUIREMENTS.md).
export async function registerPushToken(token, platform) {
  if (USE_MOCKS) return await mockRegisterPushToken(token, platform);
  return await api.post('/push-tokens', { token, platform });
}
```

- [ ] **Step 3: Escribir los tests**

```js
// __tests__/notifications-mock.test.js
import { mockRegisterPushToken } from '../services/__mocks__/notifications-mock.js';

describe('mockRegisterPushToken', () => {
  test('registra un token válido', async () => {
    const result = await mockRegisterPushToken('ExponentPushToken[abc]', 'android');
    expect(result).toEqual({ message: 'Token registrado correctamente.' });
  });

  test('rechaza si falta el token', async () => {
    await expect(mockRegisterPushToken(null, 'android')).rejects.toMatchObject({ status: 400 });
  });

  test('rechaza si falta la plataforma', async () => {
    await expect(mockRegisterPushToken('ExponentPushToken[abc]', null)).rejects.toMatchObject({ status: 400 });
  });
});
```

- [ ] **Step 4: Correr los tests**

Run: `npm test -- notifications-mock`
Expected: 3/3 PASS

- [ ] **Step 5: Commit**

```bash
git add services/notifications.js services/__mocks__/notifications-mock.js __tests__/notifications-mock.test.js
git commit -m "feat(notifications): add push token registration service"
```

---

### Task 2: Dependencia, config Android, y hook de registro/permiso/listeners

**Files:**
- Modify: `package.json` (vía `npx expo install`, no a mano)
- Modify: `app.config.js:50-57` (array `plugins`)
- Create: `hooks/use-push-notifications.js`
- Modify: `app/_layout.jsx`

**Interfaces:**
- Consumes: `registerPushToken(token, platform)` de `services/notifications.js` (Task 1); `useAuthStore` (`store/auth-store.js`, campo `user.userId`); `isMobile` de `utils/platform.js`; `toastConfig`'s tipo `'info'` de `components/feedback/paceron-toast.jsx`.
- Produces: hook `usePushNotifications()` (sin argumentos, sin valor de retorno) desde `hooks/use-push-notifications.js` — se monta una única vez en `app/_layout.jsx`.

- [ ] **Step 1: Instalar la dependencia**

Run: `npx expo install expo-notifications`
Expected: agrega `expo-notifications` a `package.json`/`package-lock.json` con la versión compatible del SDK de Expo instalado — no fijar la versión a mano.

- [ ] **Step 2: Agregar el plugin de Expo config**

En `app.config.js`, dentro del array `plugins` (línea 50-57), agregar `'expo-notifications'` como entrada nueva (bare string, mismo patrón que `'expo-font'`/`'expo-secure-store'` — no hace falta ícono/color custom todavía, no hay asset de notificación en el repo):

```js
    plugins: [
      ['expo-router', { sitemap: false }],
      ['expo-location', { locationAlwaysAndWhenInUsePermission: 'Allow Paceron to use your location for tracking runs.' }],
      ['expo-image-picker', { photosPermission: 'Allow Paceron to access your photos to set a team profile picture.' }],
      'expo-font',
      'expo-secure-store',
      '@react-native-community/datetimepicker',
      'expo-notifications',
    ],
```

- [ ] **Step 3: Escribir el hook**

```js
// hooks/use-push-notifications.js
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/auth-store.js';
import { registerPushToken } from '../services/notifications.js';
import { isMobile } from '../utils/platform.js';

// Con la app abierta (foreground) no se muestra el banner nativo del
// sistema — se maneja con Toast en el segundo useEffect de abajo, mismo
// mecanismo de feedback que el resto de la app (ver
// docs/superpowers/specs/2026-08-16-notifications-design.md).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Pide permiso tras el login, registra el token contra el backend, y
// cablea los listeners de foreground (Toast) y tap-to-navigate
// (data.route). Android-only — en web/iOS no hace nada (isMobile).
export function usePushNotifications() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const registeredForUserId = useRef(null);

  useEffect(() => {
    if (!isMobile || !user?.userId) return;
    if (registeredForUserId.current === user.userId) return;
    registeredForUserId.current = user.userId;

    (async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        await registerPushToken(token, 'android');
      } catch {
        // best-effort — permiso rechazado o fallo de red no debe romper
        // el arranque de la app; el badge in-app sigue siendo el fallback
      }
    })();
  }, [user?.userId]);

  useEffect(() => {
    if (!isMobile) return undefined;

    const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      Toast.show({ type: 'info', text1: title ?? '', text2: body ?? '' });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route;
      if (route) router.push(route);
    });

    return () => {
      foregroundSub.remove();
      responseSub.remove();
    };
  }, [router]);
}
```

- [ ] **Step 4: Montar el hook en el layout raíz**

En `app/_layout.jsx`, agregar el import y la llamada dentro de `RootLayout` (el componente ya está dentro del árbol de Expo Router, así que `useRouter()` adentro del hook funciona sin cambios estructurales):

```js
import { usePushNotifications } from '../hooks/use-push-notifications.js';
```

```js
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Orbitron_700Bold });
  usePushNotifications();
  if (!fontsLoaded) return null;
```

- [ ] **Step 5: Verificación manual (no automatizable — módulo nativo real)**

No corre en Expo Go ni en Jest/jsdom. Pasos en el emulador Android (Pixel_9 AVD) con un build de desarrollo:
1. `eas build --profile development --platform android` (o el comando ya usado para builds de dev en este proyecto) e instalar en el emulador.
2. Loguearse — debe aparecer el diálogo de permiso de notificaciones una sola vez.
3. Aceptar el permiso — confirmar en los logs de Metro que `registerPushToken` se llamó sin lanzar error (o revisar en el panel/DB de backend que el token quedó registrado, si hay acceso).
4. Disparar un trigger real (ej. mandarse una invitación de equipo a sí mismo desde otra cuenta) con la app en background — debe llegar la notificación del sistema, y al tocarla la app debe abrir directo en `/invitations`.
5. Repetir el mismo trigger con la app abierta — debe aparecer como `Toast` en vez de banner del sistema.

Expected: los 5 pasos se cumplen tal cual. Si el permiso se rechaza en el paso 2, la app debe seguir funcionando con normalidad (sin crashear, sin bloquear el login).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app.config.js hooks/use-push-notifications.js app/_layout.jsx
git commit -m "feat(notifications): register push token and wire foreground/tap handlers"
```

---

## Verificación final

- `npm test` → todos los tests en verde (incluye los 3 nuevos de Task 1).
- `npm run lint` → sin errores.
- Verificación manual de Task 2, Step 5, en el emulador Android.

## Fuera de alcance de este plan

- Web push — queda documentado a alto nivel en el spec, sin implementación (pila distinta: Push API del navegador + Service Worker + VAPID, no `expo-notifications`).
- iOS y cualquier permiso/config específico de esa plataforma.
- Pantalla de preferencias de notificación por categoría.
- Los triggers de pago (reservados en el backend, no se activan hasta que Sub-proyecto A/B tengan implementación real) — no requieren ningún cambio de este lado, ya que el mecanismo es genérico (`data.route`).

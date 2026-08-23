# Notificaciones (push Android + web) — Diseño

> Igual que los docs de pagos, este spec cubre el lado frontend. Complementa una mejora de mails que se hace del lado backend (otro repo) — mismos triggers, otro canal de entrega. No hay nada implementado todavía (ni frontend ni backend); el objetivo inmediato es coordinar el arranque de backend, la implementación frontend se retoma cuando eso esté listo.

## Objetivo

Avisar al usuario de eventos que le pasan a él (no de acciones que él mismo acaba de hacer), incluso con la app cerrada — complementa al badge in-app ya existente (`myInvitationsCount`, `store/team-store.js`), que solo se entera al abrir la app.

## Alcance de triggers — v1

Regla de selección: notifica solo al que **no se enteró en el momento por su cuenta** — se excluyó explícitamente la activación de rol entrenador (el usuario ya lo ve al instante en la propia pantalla) y cualquier acción que notifique al que la acaba de ejecutar (ej. "invitación enviada" no es un trigger, "invitación recibida" sí).

| Trigger | Para quién | Ruta de destino (`data.route`) |
|---|---|---|
| Invitación de equipo recibida | Corredor | `/invitations` |
| Respuesta a una invitación enviada (aceptada/rechazada) | Entrenador | `/teams/{teamId}` |
| Expulsión de un equipo | Corredor | `/teams` |
| Un corredor deja el equipo | Entrenador | `/teams/{teamId}` |
| Cambio de contraseña exitoso (aviso de seguridad) | Usuario que cambió la contraseña | ninguna (informativo, no navega) |
| Pago aprobado / rechazado | Usuario que pagó | pantalla de pago correspondiente (A o B, cuando existan) |
| Vencimiento próximo / plazo de gracia / expulsión por impago | Corredor (B) o usuario con tier (A) | pantalla de renovación correspondiente |

Los triggers de pago quedan reservados en la arquitectura (mismo mecanismo genérico) pero no se activan hasta que A/B tengan implementación real — no son parte del trabajo inmediato de backend.

**Fuera de alcance de este documento** (mencionado por contexto, no se está abordando): notificaciones de sesiones de entrenamiento presenciales, logros, rachas — funcionalidades que todavía no existen en el producto.

## Arquitectura — push nativo (Android)

**Proveedor:** el servicio de push de Expo (`expo-notifications`), no Firebase/FCM directo. Backend no necesita ningún SDK — alcanza con un `POST` HTTP plano a la API pública de Expo por cada trigger:

```json
{
  "to": "ExponentPushToken[xxxx]",
  "title": "Nueva invitación",
  "body": "Juan Pérez te invitó a unirte a su equipo",
  "data": { "type": "invitation_received", "route": "/invitations" }
}
```

`data.route` es el contrato central — el frontend lo usa para navegar al tocar la notificación, sin necesidad de un mapeo `type` → ruta hardcodeado del lado cliente.

**Frontend:**
1. Nueva dependencia `expo-notifications` + entrada en el array `plugins` de `app.config.js` (mismo patrón que `expo-location`/`expo-image-picker`, con ícono/color de notificación para Android). Requiere build nuevo vía EAS — no funciona en Expo Go.
2. Tras un login exitoso: pedir permiso (`Notifications.requestPermissionsAsync()`) una sola vez. Si se concede, generar el token (`getExpoPushTokenAsync({ projectId })` — el `projectId` de EAS ya está configurado en `app.config.js`, no hace falta agregarlo) y enviarlo al backend.
3. **El backend guarda el token por dispositivo (`token` como clave de upsert), no por usuario con lista fija** — si el mismo dispositivo cambia de cuenta logueada, el siguiente login reescribe el dueño del token automáticamente, sin necesidad de un endpoint de "desvincular" en logout.
4. **Notificación con la app abierta (foreground):** se muestra como `Toast` (`react-native-toast-message`, ya instalado), no como banner nativo del sistema — consistente con el resto de feedback de la app.
5. **Al tocar la notificación** (app cerrada o en background): se lee `data.route` del payload recibido y se navega ahí con Expo Router (`router.push(data.route)`).

## Permisos

Se pide **una sola vez, después del primer login exitoso** — no apenas se abre la app (mayor tasa de rechazo si se pide sin contexto). Si el usuario rechaza el permiso, la app sigue funcionando normal: el badge in-app de invitaciones pendientes sigue siendo el fallback, nada se bloquea. No hay pantalla propia de preferencias por categoría en v1 (alcanza con el permiso general de Android) — si el usuario quiere reactivarlo más adelante, es desde los ajustes del sistema operativo.

## Testing

No es posible en Expo Go — requiere build de desarrollo (aceptado de antemano). El emulador Android ya configurado en el proyecto (Pixel_9 AVD) sirve tal cual, el servicio de push de Expo funciona ahí sin necesidad de dispositivo físico ni de un build separado — no hace falta un build "liviano" aparte, el mismo dev build que ya se usa para otras pruebas nativas alcanza.

## Web push (alto nivel — menor prioridad)

Pila completamente distinta a la de arriba — no usa el servicio de Expo ni el mismo tipo de token. Usa la Push API del navegador + un Service Worker + un par de claves VAPID propias del proyecto. La versión web exporta estático (`web.output: 'static'` en `app.config.js`), así que el Service Worker se sumaría como un archivo más del build web. El backend necesitaría guardar un tipo de token distinto para web (`platform: 'web'` en la misma tabla de `push_tokens`, forma de dato distinta al token de Expo — una suscripción de Push API, no un string simple). Se deja documentado a este nivel; el diseño detallado (cuándo pedir permiso en el navegador, registro del Service Worker, generación de claves VAPID) se retoma cuando se decida arrancarlo — no bloquea el trabajo de push nativo.

## Fuera de alcance

- iOS — la app mobile es Android-only por ahora.
- Preferencias de notificación por categoría dentro de la app — v1 usa el permiso general del sistema operativo.
- Diseño detallado de web push (ver sección de arriba).
- Notificaciones de sesiones presenciales, logros, rachas — funcionalidad de producto que todavía no existe.

## Próximo paso

Backend implementa lo listado en [`BACKEND_NOTIFICATIONS_REQUIREMENTS.md`](../../BACKEND_NOTIFICATIONS_REQUIREMENTS.md). Cuando esté disponible, se retoma el trabajo frontend: agregar la dependencia, el flujo de permiso/registro de token, el handler de tap-to-navigate, y wiring de cada pantalla de destino.

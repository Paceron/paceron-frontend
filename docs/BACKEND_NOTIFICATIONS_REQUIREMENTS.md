# Requerimientos de backend — notificaciones (push Android + web)

Doc de coordinación, mismo espíritu que [`BACKEND_API_GAPS.md`](./BACKEND_API_GAPS.md) y [`BACKEND_PAYMENTS_REQUIREMENTS.md`](./BACKEND_PAYMENTS_REQUIREMENTS.md): no hay nada implementado todavía de ningún lado, es un pedido para coordinar el arranque, no un hallazgo posterior. Se actualiza a medida que backend confirme, implemente o ajuste cada punto.

**Contexto completo:** [spec de notificaciones](./superpowers/specs/2026-08-16-notifications-design.md).

Complementa una mejora de mails que se hace en paralelo del lado backend — misma lista de triggers, otro canal de entrega (push en vez de/además de mail).

## Registro de dispositivo

| Necesidad | Detalle | Por qué |
|---|---|---|
| Endpoint para registrar/actualizar el token de push de un dispositivo | Ej. `POST /api/v1/push-tokens` — `{ token, platform: 'android'\|'web' }`, autenticado (el `user_id` sale del token de sesión, no del body) | El frontend lo llama después de cada login exitoso |
| Tabla `push_tokens (user_id, token, platform, created_at)`, **upsert por `token` como clave única**, no por `user_id` | El mismo `token` puede pasar de un usuario a otro si el dispositivo cambia de cuenta logueada — el upsert por token resuelve esto solo, sin necesidad de un endpoint de "desvincular" en logout | Evita mandar push a una cuenta vieja en un dispositivo compartido/reinstalado |

## Envío de push — mecanismo genérico

| Necesidad | Detalle | Por qué |
|---|---|---|
| Backend dispara un `POST` a `https://exp.host/--/api/v2/push/send` (API pública de Expo) en cada trigger de la tabla de abajo | No requiere SDK — HTTP plano. Cuerpo: `{ "to": "<token>", "title", "body", "data": { "type", "route" } }` | Mismo servicio para todos los dispositivos Android de la app, sin pasar por Firebase/APNs directo |
| `data.route` viaja en cada push, ya resuelto del lado backend | Ej. `/invitations`, `/teams/{teamId}` | El frontend no mapea `type` → ruta localmente, solo navega a lo que backend le mande |

## Triggers v1 — a implementar

| Trigger | Para quién | `data.type` sugerido | `data.route` sugerido |
|---|---|---|---|
| Invitación de equipo recibida | Corredor | `invitation_received` | `/invitations` |
| Respuesta a invitación enviada (aceptada/rechazada) | Entrenador | `invitation_response` | `/teams/{teamId}` |
| Expulsión de un equipo | Corredor | `team_removed` | `/teams` |
| Un corredor deja el equipo | Entrenador | `team_member_left` | `/teams/{teamId}` |
| Cambio de contraseña exitoso | Usuario que la cambió | `password_changed` | ninguna (informativo) |

**Reservados para cuando A/B tengan implementación real (no forman parte de este arranque):** pago aprobado, pago rechazado, vencimiento próximo, plazo de gracia/mora, expulsión automática por impago — mismo mecanismo genérico de arriba, se agregan como triggers nuevos sin cambiar nada de lo ya construido.

## Env vars / claves nuevas

| Variable | Dónde | Uso |
|---|---|---|
| Ninguna nueva del lado frontend para push Android | — | El `projectId` de EAS que usa `getExpoPushTokenAsync` ya está configurado en `app.config.js`, no hace falta nada nuevo |
| Par de claves **VAPID** (público/privado) | Backend, cuando se implemente web push | Necesarias para que el navegador confíe en las notificaciones que manda el backend — no aplica a la fase Android |

## Web push — no forma parte de este arranque

Pila distinta a la de Android (Push API del navegador + Service Worker + VAPID, no el servicio de Expo) — queda fuera de este pedido de arranque. Se documenta a alto nivel en el spec de frontend; se vuelve a coordinar con backend cuando se decida encararlo.

## Orden sugerido de coordinación

1. Backend implementa el registro de dispositivo (tabla + endpoint) y el mecanismo genérico de envío — es infraestructura, no depende de decidir nada de negocio.
2. Backend cablea los 5 triggers de la tabla de arriba en los mismos puntos donde ya dispara (o va a disparar) el mail correspondiente.
3. Frontend agrega `expo-notifications`, el flujo de permiso/registro de token, y el handler de tap-to-navigate — se retoma cuando el punto 1 esté disponible para probar de punta a punta.
4. Los triggers de pago se suman más adelante, en paralelo al desarrollo de A/B — no bloquean nada de lo de arriba.

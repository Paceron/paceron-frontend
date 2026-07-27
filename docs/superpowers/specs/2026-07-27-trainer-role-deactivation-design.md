# Baja de rol entrenador — Design

**Fecha:** 2026-07-27
**Estado:** Aprobado, implementación directa (sin plan — diseño concreto, espeja patrones existentes)

## Contexto

El backend agregó soporte para dar de baja el rol entrenador: `DELETE /api/v1/users/{id}/roles/{role_id}` elimina la asociación usuario-rol. El frontend hoy solo sabe *activar* el rol (`activateTrainerRole()` en `store/auth-store.js`) — no existe forma de darlo de baja.

**Decisión de negocio (dada por el usuario):** al dar de baja, **no se borra el `bank_alias`** — se mantiene guardado. Si el usuario reactiva el perfil de entrenador más adelante, `activate-trainer-screen.jsx` pre-completa el campo de alias con el valor guardado (editable), evitando que tenga que volver a tipearlo si es el mismo.

## Alcance

**Dentro:** acción de baja (botón + confirmación liviana en la zona de peligro del perfil), lógica de backend (`removeRole` + `deactivateTrainerRole`), ajuste de `activeRole` si estaba en `'trainer'`, prefill del alias en la reactivación.

**Fuera:** cualquier cambio a `role-switch-toggle.jsx` (no hace falta — ya oculta el switch y muestra el pill de activación en cuanto `roles` no tiene `entrenador`, comportamiento existente sin tocar). Equipos que el usuario administre como entrenador y qué pasa con ellos al dar de baja — no hay integración de equipos todavía en el frontend real, queda fuera de alcance hasta que exista.

## Decisiones

### Ubicación y confirmación

Botón nuevo en la "Zona de peligro" de `profile-screen.jsx` (mismo lugar que "Borrar cuenta"), visible solo si `hasTrainerRole`. Confirmación **liviana** — un modal con Cancelar/Confirmar, sin input de texto a tipear (a diferencia de `DeactivateAccountModal`, que exige tipear el email porque borra la cuenta entera; acá es reversible y no pierde datos, un click alcanza).

### Qué pasa con `activeRole` y `bank_alias`

- `bank_alias` se mantiene sin cambios en el backend — no se envía ningún `PUT /users/{id}` durante la baja.
- Si `activeRole` era `'trainer'` en el momento de la baja, se resetea a `'runner'` explícitamente (evita quedar con un `activeRole` que ya no tiene rol asignado detrás).
- `roles` se refresca con `fetchPermissions()` después de la baja, mismo patrón que `activateTrainerRole()`.

### Reactivación con alias pre-cargado

`activate-trainer-screen.jsx` inicializa el campo de alias con `user.bankAlias` (si existe) en vez de string vacío, editable. Se agrega un texto chico debajo del campo, solo visible cuando había un valor pre-cargado: "Detectamos un alias guardado de una activación anterior — podés cambiarlo si querés."

## Archivos

### Nuevos
- `components/profile/deactivate-trainer-modal.jsx` — modal de confirmación liviana, mismo lenguaje visual que `deactivate-account-modal.jsx` (rojo, ícono de alerta) pero sin input de confirmación tipeada.

### Modificados
- `services/roles.js` — nueva `removeRole(userId, roleName)`, mismo patrón que `assignRole` (resuelve `role_id` vía `getRoleIdByName`, llama `api.delete`).
- `services/__mocks__/roles-mock.js` — nuevo `mockRemoveRole`, mismo patrón que `mockAssignRole`.
- `store/auth-store.js` — nueva `deactivateTrainerRole()`.
- `components/profile/profile-screen.jsx` — `DangerZone` gana un segundo bloque (con divisor), "Dar de baja perfil de entrenador" arriba de "Borrar cuenta" (menos severo primero), visible solo si `hasTrainerRole`.
- `components/profile/activate-trainer-screen.jsx` — prefill del alias + texto de detección.

## Verification

- `npm test` → 44/44 sin romperse (sin tests de render nuevos, convención del proyecto).
- `npm run lint` → 0 errores, `nativeID`/`testID` en todo lo nuevo.
- Preview con `EXPO_PUBLIC_USE_MOCKS=true`: activar entrenador → verificar switch Corredor/Entrenador y "Datos de entrenador" en el perfil → dar de baja desde la zona de peligro (modal liviano) → verificar que el switch desaparece y vuelve el pill "Volverse Entrenador" → reactivar → verificar que el campo de alias viene pre-completado con el valor anterior.

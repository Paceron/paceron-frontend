# Activación de entrenador: pantalla dedicada + validación de alias — Design

**Fecha:** 2026-07-14
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

Hoy activar el perfil de entrenador abre `ActivateTrainerModal`
(`components/shell/activate-trainer-modal.jsx`), un modal de
confirmar/cancelar sin ningún campo. Desde el trabajo de
`role-dropdown-cleanup`, la activación solo es alcanzable desde
`RoleManagementSection` cuando se renderiza en `ProfileScreen` (dropdown y
sidebar ya no muestran el botón de activar, solo el de cambiar rol) — un
único punto de entrada.

Se agrega un alias de pago obligatorio al activar, con validación de
formato. Un modal es un mal lugar para eso a futuro (términos y
condiciones, más campos de activación) — se reemplaza por una pantalla
dedicada, mismo patrón que `EditProfileScreen`. Además, el campo CBU/CVU
agregado en `profile-roles-section` (spec anterior) se elimina — solo
queda el alias.

## Alcance de esta spec

Nueva ruta `app/(tabs)/profile/activate-trainer.jsx`. Cambios en
`store/auth-store.js`, `components/shell/role-management-section.jsx`,
`components/profile/profile-screen.jsx`,
`components/profile/edit-profile-screen.jsx`. Nuevo
`utils/trainer-alias-validators.js`. Borra
`components/shell/activate-trainer-modal.jsx` (queda obsoleto).

**No** incluye: términos y condiciones (mencionado como posible evolución
futura, la pantalla dedicada deja espacio para agregarlo después, pero no
se implementa ahora). Integración con backend real (roles/alias siguen
siendo 100% local, el backend no tiene esto implementado).

## Decisiones

### Validador (`utils/trainer-alias-validators.js`)

Mismo patrón que `utils/dni-validators.js` — una función,
`null` si es válido o un string de error:

```js
export function validateTrainerAlias(value) {
  if (!value || !value.trim()) return 'El alias es requerido.';
  const clean = value.trim();
  if (clean.length < 6 || clean.length > 20) return 'El alias debe tener entre 6 y 20 caracteres.';
  if (!/^[a-zA-Z0-9.-]+$/.test(clean)) return 'El alias solo puede tener letras, números, puntos y guiones.';
  return null;
}
```

Reglas: 6-20 caracteres, solo letras (may/min), números, puntos y guiones
medios. Son *restricciones* de formato, no requisitos de composición — no
hace falta que tenga punto ni guion, solo que no tenga nada fuera de ese
conjunto de caracteres.

### Store (`store/auth-store.js`)

- `activateTrainerProfile(trainerAlias)` — pasa a recibir el alias como
  argumento. Setea `trainerActivated: true` y `trainerAlias` en el mismo
  `set()`, persiste igual que hoy (mismo mecanismo).
- `trainerCbu` se elimina por completo: del estado inicial, de `hydrate`,
  de todos los `persist(...)` que lo incluían, y de `logout()`.
  `updateTrainerData({ trainerAlias })` pierde el parámetro `trainerCbu`
  (ya no aplica).

### Pantalla `app/(tabs)/profile/activate-trainer.jsx`

Mismo patrón visual/estructural que `EditProfileScreen`:
- Header combinado `← Mi perfil / Activar perfil de entrenador` (mismo
  componente/estilo de breadcrumb ya usado en editar — "Mi perfil" es el
  link de vuelta a `/profile`, "Activar perfil de entrenador" resaltado
  como título de la pantalla actual).
- Texto descriptivo reutilizado del modal actual: "Vas a poder gestionar
  equipos, planificar entrenamientos y alternar entre tu perfil de
  corredor y de entrenador cuando quieras."
- Un `InputField` "Alias de pagos", validado en vivo con
  `validateTrainerAlias` (mismo patrón `touched`/`error` que el resto de
  los formularios — error solo se muestra tras `onBlur` o intento de
  submit, igual que DNI/email en `RegisterScreen`).
- Botón "Activar" (ícono `whistle`, mismo estilo ámbar que tenía el botón
  de confirmar del modal): deshabilitado mientras `validateTrainerAlias`
  devuelva error. Al presionar: `activateTrainerProfile(alias)`, luego
  `router.replace('/profile')`.
- Sin botón "Cancelar" separado — el link "Mi perfil" del breadcrumb ya
  permite volver sin activar (mismo patrón que `EditProfileScreen`, que
  tampoco tiene un botón de cancelar explícito).

### `RoleManagementSection`

`handlePress`: cuando `!trainerActivated`, en vez de `setModalVisible(true)`
pasa a `router.push('/profile/activate-trainer')`. Se elimina el estado
`modalVisible` y el render de `<ActivateTrainerModal>` — el componente ya
no necesita `useRouter` importado si no lo tenía (agregar si falta).

### `activate-trainer-modal.jsx`

Se borra el archivo — reemplazado por la pantalla dedicada.

### `ProfileScreen` / `EditProfileScreen`

- `TrainerDataSection` (vista, en `ProfileScreen`) pierde el `Field`
  "CBU/CVU" — solo queda "Alias de pagos".
- La sección "Datos de entrenador" en `EditProfileScreen` pierde el
  `InputField` CBU/CVU. El `InputField` de Alias que queda usa
  `validateTrainerAlias` (mismo criterio que al activar — `error`/
  `touched` igual que el resto de los campos del form). El submit sigue
  llamando `updateTrainerData({ trainerAlias })` (ya no manda
  `trainerCbu`).

## Fuera de alcance

Términos y condiciones en la pantalla de activación (la pantalla dedicada
deja lugar para esto después, no se construye ahora). Persistencia real
en backend de roles/alias. Reintroducir CBU/CVU — se elimina, no se oculta.

## Verificación

Web preview (`EXPO_PUBLIC_USE_MOCKS=true`):
1. Desde `/profile`, sin entrenador activado: tocar "Activar perfil de
   entrenador" navega a `/profile/activate-trainer` (ya no abre modal).
2. Botón "Activar" deshabilitado con el campo vacío o con un alias
   inválido (menos de 6 caracteres, más de 20, o con caracteres fuera de
   letras/números/punto/guion — probar con un espacio o un `@`, por
   ejemplo). Mensaje de error visible tras salir del campo.
3. Con un alias válido, "Activar" queda habilitado; al presionar, vuelve
   a `/profile` con el perfil de entrenador activado y el alias guardado
   (visible en la sección ámbar "Datos de entrenador", sin CBU/CVU).
4. `/profile/edit`: sección "Datos de entrenador" solo muestra Alias
   (sin CBU/CVU), con la misma validación — probar guardar un alias
   inválido y confirmar que no deja.
5. Dropdown web y sidebar mobile: con entrenador ya activado, el pill de
   cambiar rol sigue funcionando igual que antes (sin cambios ahí).

`npm test` → 32/32 verde (más los tests nuevos que agregue el plan, si
corresponde para el validador).

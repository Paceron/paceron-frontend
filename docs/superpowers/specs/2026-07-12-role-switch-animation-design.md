# Animación fullscreen de cambio de rol — Design

**Fecha:** 2026-07-12
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

`RoleManagementSection` (ver `docs/superpowers/specs/2026-07-11-role-management-ui-design.md`)
ya permite activar el perfil de entrenador y alternar entre corredor/entrenador
vía `switchRole()`. Hoy el cambio es instantáneo (sin feedback visual más allá
del badge/action-row actualizándose). Se agrega una transición fullscreen breve
para el momento de alternar, dejando la puerta abierta a que en el futuro
(cuando existan pantallas/homes dedicados por rol) esta misma transición
decida quedarse en la pantalla actual o navegar, según corresponda.

## Alcance de esta spec

Solo la transición visual + navegación a Inicio al alternar rol. **No**
incluye: contenido diferenciado por rol en el home, lógica de "pantalla común
vs. dedicada al rol" (mencionada como evolución futura, explícitamente fuera
de alcance ahora — por ahora siempre navega a `/`).

## Decisiones

- **Trigger**: únicamente `switchRole()` (alternar entre roles ya
  activados). La activación inicial (`activateTrainerProfile()`, vía el modal
  de confirmación) **no** dispara este overlay.
- **Contenido**: ícono grande (`run-fast` para corredor, `whistle` para
  entrenador) + texto "Cambiando a Corredor…" / "Cambiando a Entrenador…",
  sobre fondo del color del rol destino (verde/ámbar). Simple, reemplazable
  después por algo más rico cuando haya contenido real por rol.
- **Duración**: ~2000ms visible, luego fade-out automático. Sin tap-to-skip.
- **Navegación**: al dispararse, navega a `/` (Inicio) vía `router.replace`.
  Cubre cualquier pantalla desde la que se dispare el cambio.
- **Ubicación del overlay**: montado a nivel global (`app/_layout.jsx`, mismo
  nivel que el `Toast`), no dentro de un shell específico — así cubre
  cualquier ruta sin importar dónde estaba el usuario al alternar.

## Estado (store)

`store/auth-store.js` suma:
- `roleSwitchAnimating`: `{ role: 'runner' | 'trainer' } | null`, default
  `null`. Dato puro — el store no dispara navegación ni temporizadores, eso
  vive en el componente que lo consume.
- `switchRole()` (ya existe) además de alternar `activeRole`, setea
  `roleSwitchAnimating: { role: <nuevo activeRole> }` cuando el switch
  efectivamente ocurre (no cuando es no-op por `!trainerActivated`).
- Nueva acción `clearRoleSwitchAnimation()`: setea `roleSwitchAnimating:
  null`. No persiste (es puramente de UI en memoria, no forma parte de la
  sesión guardada).

## Componente

`components/shell/role-switch-overlay.jsx`, export `RoleSwitchOverlay()`
(sin props — lee todo del store). Responsabilidades:
1. Se suscribe a `roleSwitchAnimating`.
2. En un `useEffect` sobre ese valor: cuando pasa de `null` a no-null,
   `router.replace('/')`, anima entrada (fade+scale del ícono/texto vía
   Reanimated), arranca un `setTimeout` de ~2000ms que dispara el fade-out;
   al terminar el fade-out, llama `clearRoleSwitchAnimation()`.
3. Cuando `roleSwitchAnimating` es `null`, no renderiza nada (o renderiza
   con `pointerEvents: 'none'` y opacidad 0, seguir el mismo patrón ya usado
   en `AnimatedDropdown`/`ActivateTrainerModal` de mantener montado y animar
   opacity en vez de montar/desmontar duro, para permitir el fade-out).

Montado en `app/_layout.jsx`, junto al `<Toast />` existente.

## Fuera de alcance

Contenido diferenciado por rol. Lógica de "quedarse si la pantalla es común
a ambos roles, navegar solo si es dedicada" — explícitamente pospuesta hasta
que existan esas pantallas dedicadas. Tap-to-skip.

## Verificación

Web preview: alternar rol desde una pantalla que no sea `/` (ej. `/profile`),
confirmar que aparece el overlay, navega a `/`, y desaparece solo a los ~2s
dejando el badge/header ya actualizado al nuevo rol.

# Consistencia de botones: fondo + hover mínimo — Design

**Fecha:** 2026-07-22
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

Disparador puntual: el botón "Ingresar" de la landing (`home-landing-screen.jsx`
web y `home-mobile-screen.jsx` mobile) es solo un borde sin relleno — se ve
"muerto" al lado del CTA sólido "Registrate". El usuario pidió arreglarlo
(fondo sólido o traslúcido, como el botón "Volverse Entrenador" en
`role-switch-toggle.jsx`, que usa `bg-amber-500/15`) y, de paso, pidió una
auditoría completa: **todo botón de la app debe tener animación de hover
mínima** (no solo `active:` de press).

Catálogo relevado (135 `Pressable` en 18 archivos): la mayoría de los
botones sólidos (`bg-primary`) y traslúcidos (`bg-amber-500/15`) solo tienen
`active:opacity-XX`, sin `hover:`. Los items del drawer mobile no tienen
hover en absoluto. Los links de texto de auth (¿Olvidaste tu contraseña?,
etc.) no tienen ningún feedback interactivo. En cambio, el nav/dropdown web
(`app-web-shell.jsx`) ya tiene un patrón de hover consistente y es la mejor
referencia existente: `hover:bg-slate-100 dark:hover:bg-slate-800`.

`hover:` es un no-op inerte en nativo (react-native-web lo traduce a
`:hover` de CSS solo para el target web; en iOS/Android simplemente no
aplica) — agregarlo en todos lados es seguro, no rompe nada en mobile.

## Alcance de esta spec

Agregar `hover:` (y, en el caso puntual del botón Ingresar, fondo) a los
135 `Pressable` catalogados, agrupados por familia visual. **No** cambia el
comportamiento de `active:` existente donde ya está bien — solo suma
`hover:` faltante y, para "Ingresar", cambia el fondo.

## Decisiones

### 1. Botón "Ingresar" (landing, web + mobile)

Pasa de outline (`border`, sin fondo) a fondo sólido neutro — mismo tono
que ya usa el nav/dropdown para su estado neutral (`bg-slate-100` /
`dark:bg-slate-800`), no verde: es una acción secundaria de navegación, no
una selección de rol/estado (el verde tint ya tiene ese significado
específico en la app — badges activos, segmentos seleccionados). Se saca
el `border` (redundante con fondo sólido).

```
Antes (web):    border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800
Antes (mobile): border border-slate-300 dark:border-slate-700   (sin hover)

Después (ambos):
  bg-slate-100 dark:bg-slate-800
  hover:bg-slate-200 dark:hover:bg-slate-700
```

### 2. Convención de hover por familia (para el resto de los 135)

| Familia | Ejemplo | Antes | Se agrega |
|---|---|---|---|
| CTA sólido (`bg-primary`, `bg-amber-500`, `bg-red-600`) | "Registrate", "Activar", "Confirmar baja" | solo `active:opacity-80` | `hover:opacity-90` |
| Traslúcido/tint (`bg-amber-500/15`, `bg-primary-tint`) | "Volverse Entrenador" | solo `active:opacity-70` | `hover:opacity-90` |
| Neutral/outline/icon-only (sin fondo o solo borde) | back buttons, toggles de campo, drawer items | variable, casi todos sin hover | `hover:bg-slate-100 dark:hover:bg-slate-800` (si no lo tiene ya) |
| Link de texto (sin fondo, sin borde) | "¿Olvidaste tu contraseña?", "Mejorar tier" | sin ningún feedback | `hover:opacity-70` |
| Nav/dropdown ya cubierto (`app-web-shell.jsx` tabs/dropdowns) | — | ya tiene `hover:bg-slate-100 dark:hover:bg-slate-800` | sin cambios |

`hover:opacity-90` se eligió (en vez de un nuevo `hover:bg-*`) para botones
con fondo de color propio — cambiar de fondo ahí requeriría un tono por
color (verde, ámbar, rojo) y opacity ya da suficiente feedback sin inventar
tokens nuevos. Coincide con el único precedente ya en el código
(`profile-screen.jsx`, botón "Editar datos").

### Archivos afectados (por familia, no exhaustivo línea por línea — ver plan)

- CTA sólido: `home-landing-screen.jsx`, `home-mobile-screen.jsx`,
  `login-screen.jsx`, `register-screen.jsx`, `forgot-password-form.jsx`,
  `edit-profile-screen.jsx`, `activate-trainer-screen.jsx`,
  `app/+not-found.jsx`, `deactivate-account-modal.jsx`, `fields.jsx`
  (botón "Listo" del date picker).
- Traslúcido/tint: `role-switch-toggle.jsx`.
- Neutral/outline/icon-only: `profile-screen.jsx` (Borrar cuenta),
  `deactivate-account-modal.jsx` (Cancelar), `login-screen.jsx`/
  `register-screen.jsx` (toggles de password, back buttons ya cubiertos),
  `fields.jsx` (clear/picker buttons), `edit-profile-screen.jsx`/
  `activate-trainer-screen.jsx`/`tier-upgrade-screen.jsx` (breadcrumb
  "Mi perfil"), `app-mobile-shell.jsx` (menu toggle + todos los items del
  drawer), `section-card.jsx` (header colapsable), `theme-toggle.jsx`.
- Link de texto: `login-screen.jsx`, `register-screen.jsx`,
  `forgot-password-form.jsx`, `role-switch-toggle.jsx` ("Mejorar tier").

## Fuera de alcance

- No se tocan botones que ya tienen `hover:` correcto (nav/dropdown web).
- No se rediseña ningún color/estructura más allá de agregar `hover:` y el
  fondo puntual de "Ingresar".
- `paceron-toast.jsx` (Pressable de dismiss) queda fuera — es un
  componente efímero (aparece/desaparece solo), no amerita micro-feedback
  de hover.

# Contraste del tema claro — Design

**Fecha:** 2026-07-14
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

El tema oscuro tiene una escala tonal propia con capas distinguibles
(`ink` #0d1013 página, `surface` #111518 header/cards, `surface-2`
#1d2125, `surface-3` #282d31) y usa tintes de verde translúcido
(`bg-primary/15`, `/20`) sobre esas superficies oscuras, donde sí se
perciben bien. El tema claro no tiene una escala equivalente: la página
usa `bg-slate-50` (#f8fafc) y las cards `bg-white` (#ffffff) — casi
indistinguibles entre sí — y los mismos tintes translúcidos de verde
sobre fondo blanco quedan prácticamente invisibles (`bg-primary/15`
sobre blanco es un verde casi imperceptible). El resultado es una UI en
claro que se percibe plana y "demasiado blanca", notorio sobre todo en
la landing (badges, íconos de features) y en los badges de rol.

## Alcance de esta spec

Cambios de color puramente en modo claro: `tailwind.config.js` (nuevos
tokens) y todos los archivos que usan `bg-slate-50` como fondo de
pantalla o `bg-primary/10`, `/15`, `/20` como tinte. Ver lista completa
en la sección "Archivos afectados".

**No** incluye: tema oscuro (sin cambios, ya tiene contraste adecuado).
Botones sólidos (`bg-primary` sin opacidad, quedan igual). Danger zone
(rojo, sin cambios). Secciones ámbar de "datos de entrenador" (sin
cambios). Bordes (`border-slate-*`, sin cambios — el ajuste es
exclusivamente de fondos).

## Decisiones

### Nuevos tokens (`tailwind.config.js`, dentro de `theme.extend.colors`, junto a `primary`/`ink`/`surface`)

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

- **`paper`** (`#f3efe4`, papel cálido): reemplaza `bg-slate-50` como
  fondo de pantalla en todas las screens/scrolls de nivel superior. Un
  paso más oscuro que el header/cards (`bg-white`), igual que `ink` es
  un paso más oscuro que `surface` en dark — misma relación,
  invertida en luminosidad.
- **`primary-tint`** (`#dcec9e`, verde opaco): reemplaza `bg-primary/15`
  y `bg-primary/20` — badges de rol, avatares circulares, chips/pills
  de la landing, íconos de features.
- **`primary-tint-subtle`** (`#eef3dc`, verde opaco más claro):
  reemplaza `bg-primary/10` — ítem activo del menú de navegación,
  opción seleccionada en dropdowns/selects. Mantiene el mismo peso
  visual relativo que hoy (más sutil que los badges), pero opaco en vez
  de translúcido.
- **`on-primary-tint`** (`#3c6b12`, verde oscuro): color de texto/ícono
  para usar junto a `primary-tint`/`primary-tint-subtle`. El
  `text-primary` actual (`#8cc63e`, verde brillante) no tiene contraste
  suficiente sobre los tints opacos nuevos (verde claro sobre verde
  claro) — se reemplaza por este verde oscuro en esos casos puntuales.

### Mecánica de reemplazo (preserva el dark theme intacto)

Cada clase reemplazada agrega el valor viejo como override `dark:`
explícito, para que dark theme siga renderizando exactamente igual que
hoy:

| Antes | Después |
|---|---|
| `bg-slate-50` (como fondo de pantalla) | `bg-paper dark:bg-ink` (o el `dark:` que ya tuviera esa línea) |
| `bg-primary/15` | `bg-primary-tint dark:bg-primary/15` |
| `bg-primary/20` | `bg-primary-tint dark:bg-primary/20` |
| `bg-primary/10` | `bg-primary-tint-subtle dark:bg-primary/10` |
| `text-primary` (solo cuando acompaña a uno de los tints de arriba) | `text-primary-tint dark:text-primary` |

`bg-slate-50` que **no** es fondo de pantalla (ej. algún uso puntual
distinto) se revisa caso por caso — no se reemplaza automáticamente sin
verificar que sea realmente el contenedor de más alto nivel de la
pantalla.

### Archivos afectados

Fondo de pantalla (`bg-slate-50` → `bg-paper`):
`app/+not-found.jsx`, `components/auth/forgot-password-form.jsx`,
`components/auth/login-screen.jsx`, `components/auth/register-screen.jsx`,
`components/forms/fields.jsx`, `components/home/authenticated-home-screen.jsx`,
`components/home/home-landing-screen.jsx`, `components/home/home-mobile-screen.jsx`,
`components/profile/activate-trainer-screen.jsx`,
`components/profile/deactivate-account-modal.jsx`,
`components/profile/edit-profile-screen.jsx`, `components/profile/profile-screen.jsx`,
`components/shell/app-loading-screen.jsx`, `components/shell/app-web-shell.jsx`.

Tinte verde (`bg-primary/1X`, `/2X` → tokens opacos):
`app/+not-found.jsx`, `components/auth/forgot-password-form.jsx`,
`components/feedback/paceron-toast.jsx`, `components/forms/fields.jsx`,
`components/home/authenticated-home-screen.jsx`,
`components/home/home-landing-screen.jsx`, `components/home/home-mobile-screen.jsx`,
`components/profile/profile-screen.jsx`, `components/shell/app-mobile-shell.jsx`,
`components/shell/app-web-shell.jsx`, `components/shell/role-badge.jsx`,
`components/shell/role-management-section.jsx`.

(Listas confirmadas por grep al momento de escribir esta spec — el plan
de implementación debe re-confirmar contra el código vigente al
ejecutarse, por si algo cambió entre medio.)

## Fuera de alcance

Tema oscuro completo. Botones sólidos, danger zone, secciones ámbar.
Bordes (`border-slate-*`). Introducir una tercera capa de superficie
tipo "card-2"/anidada — no existe hoy ese patrón de anidamiento real en
el código (se descartó tras revisar que los mockups de la fase de
diseño mostraban una capa que no corresponde a la estructura JSX
actual). Rediseño de la landing más allá de los colores (layout,
copy, etc.).

## Verificación

Web preview, modo claro:
1. Landing (`/`): página con tinte cálido perceptible, distinguible del
   header y de las cards blancas. Badge "Potenciado por IA" y los
   íconos de features en verde opaco visible, no translúcido/lavado.
2. `/profile`: badge de rol "Corredor" en verde opaco legible, texto
   verde oscuro (no el verde brillante actual, que quedaría ilegible).
3. `/login`, `/register`, `/profile/edit`, `/profile/activate-trainer`:
   fondo de página con el nuevo tono, header/cards blancos destacan
   correctamente sobre él.
4. Dropdown web y sidebar mobile: ítem de ruta activa y opción
   seleccionada en selects, mismo peso visual relativo que antes, ahora
   opaco.
5. **Modo oscuro sin cambios** — comparar antes/después en dark, debe
   verse idéntico.

`npm test` → 32/32 verde (cambios puramente visuales, sin lógica).

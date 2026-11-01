# Lavado de cara visual — paleta, contenedores, tabs

**Rama:** `feature/visual-design-refresh`

## Contexto

Pulido visual general de la app (web ancho + angosto, mobile), sin cambios de lógica
ni de datos. Dos problemas de fondo, ambos reportados por el usuario tras revisar la
app en uso real:

1. **Elementos sueltos sobre el canvas.** La mayoría de las pantallas renderizan su
   contenido directo sobre el fondo de página (`bg-paper dark:bg-ink`), sin ningún
   contenedor que lo agrupe visualmente — la única excepción hoy es
   `team-detail-screen.jsx`, que envuelve todo en una card con fondo, borde y
   redondeo propios (`team-detail-screen-container`). La regla a generalizar: todo
   el contenido de una pantalla vive dentro de algo visible, nunca "flotando"
   directo sobre el canvas.
2. **Paleta sin disciplina.** Tema claro: todo demasiado claro, contraste bajo
   (fondos/bordes pálidos sobre blanco). Tema oscuro: demasiados tonos distintos sin
   relación entre sí (tokens custom `surface`/`surface-2`/`surface-3` con un matiz, más
   `slate-700/800/900` sueltos en distintas pantallas con otro matiz).

## Alcance

Toda la app — web (ancho y angosto) y mobile. El trabajo real pantalla por pantalla
queda para el plan de implementación; este spec define el sistema (tokens, componente
nuevo, reglas) que ese plan aplica.

**Fuera de alcance:** cambios de layout/estructura de datos, nuevas features, el color
de marca (`primary`, verde, sin cambios), tipografía (Orbitron para títulos, sin
cambios).

## Paleta

### Fondo de página — redefinición de tokens existentes

`paper` y `ink` (`tailwind.config.js`) ya se usan como `bg-paper dark:bg-ink` en
~60 pantallas, siempre como fondo de página — confirmado que no se usan para nada
más (ni texto, ni borde) en ningún otro lugar del código. Redefinir su VALOR
(no su nombre, no los call sites) propaga el cambio a toda la app sin tocar un
solo archivo de pantalla:

| Token | Antes | Después | Uso |
|---|---|---|---|
| `paper` | `#f3efe4` | `#cbd5e1` (slate-300) | fondo de página, claro |
| `ink` | `#0d1013` | `#020617` (slate-950) | fondo de página, oscuro |

### Jerarquía de superficies oscuras — mismo mecanismo

`surface`/`surface-2`/`surface-3` (hoy un matiz propio, no-slate) se redefinen a la
escala slate para que TODO lo que ya usa `dark:bg-surface`/`-2`/`-3` en la app
(decenas de usos, cards, dropdowns, modales) quede alineado con la nueva paleta sin
tocar esos archivos tampoco:

| Token | Antes | Después |
|---|---|---|
| `surface` | `#111518` | `#0f172a` (slate-900) |
| `surface-2` | `#1d2125` | `#1e293b` (slate-800) |
| `surface-3` | `#282d31` | `#334155` (slate-700) |

### Contenedor de contenido (card por pantalla)

Validado con mockups contra el usuario — ver resumen de valores:

- **Claro:** card `bg-white`, **sin borde** (el salto slate-300→blanco ya se lee
  solo), `rounded-2xl`.
- **Oscuro:** card `bg-surface` (ahora slate-900), **con borde mínimo**
  `dark:border-surface-2` (slate-800) — el salto slate-950→slate-900 es más sutil,
  necesita el borde para leerse.
- **Contenido anidado dentro de la card** (un nivel más adentro, equivalente al
  variant `nested` de `SectionCard` ya existente): claro `bg-slate-50` +
  `border-slate-200` (hairline, necesario — blanco vs slate-50 es casi
  indistinguible sin él); oscuro `bg-surface-2` (slate-800), sin borde extra
  (el salto contra la card ya alcanza).
- **Sin sombras en ningún nivel** — regla explícita del usuario, se retiran los
  `shadow-*` existentes donde aparezcan en este trabajo.
- **Bordes solo donde hacen falta** para que algo se distinga — no por default.

### Tabs y subtabs

Mismo problema de fondo en los dos: el estado inactivo hoy depende de `hover:` para
tener cualquier fondo — en mobile (sin hover) o en reposo en web, una tab inactiva es
texto plano sin ningún límite visual, se pierde en pantallas con mucho contenido.

- **Tabs de primer nivel** (`TabBar` variant `default`): pill con fondo SIEMPRE
  visible, no solo al activarse. Activa: mismo tratamiento verde ya existente
  (`bg-primary-tint-subtle dark:bg-primary/10`, sin cambios — ya cumple el
  objetivo). Inactiva: pasa a tener un fondo neutro propio en reposo (hoy
  transparente hasta el hover) — tono exacto a afinar en preview, dirección
  confirmada con el usuario vía mockup.
- **Subtabs** (`TabBar` variant `compact`): el usuario rechazó convertir cada ítem
  en su propia pill — prefiere conservar el mecanismo actual (subrayado + color en
  el activo, texto plano en el resto) y agregarle un marco único: el grupo entero
  (no cada ítem) recibe un borde liviano + bordes redondeados, a modo de contenedor
  que indica "esto es un control", sin que cada subtab individual gane peso visual
  propio.

### Badges / colores semánticos

No se eliminan los colores semánticos (success=verde, warning=ámbar, danger=rojo)
— se disciplinan a UN par de tonos fijo por color, reusado en toda la app en vez de
que cada pantalla arme su propia combinación. Validado sin objeciones en los
mockups: claro `bg-{color}-50` + `text-{color}-700`; oscuro `bg-{color}-900/20` +
`text-{color}-400` (ajustar tono exacto de texto oscuro en preview si hace falta
legibilidad).

### Botones

Primario: fondo verde de marca (sin cambios, `bg-primary`). Secundario: estilo
outline/ghost — borde `slate-300`/`dark:border-slate-700`, texto `slate-700`/
`dark:text-slate-200`, sin fondo sólido propio.

## Componente nuevo: `ScreenCard`

`components/shared/screen-card.jsx` (ubicación a confirmar contra la convención del
repo al escribir el plan). Responsabilidad única: la card de contenido descripta
arriba — bg, borde condicional por tema, `rounded-2xl`, el `max-w-3xl self-center`
en web ancho (mismo patrón ya repetido hoy en session-pre-start-screen.jsx y otras).
**No maneja el fondo de página** — eso lo sigue resolviendo cada pantalla con su
`bg-paper dark:bg-ink` ya existente (ahora con los valores nuevos), `ScreenCard` es
el nivel de adentro.

```jsx
<ScreenCard padded>
  {/* contenido de la pantalla */}
</ScreenCard>
```

`padded` (default `true`) agrega el `p-4` de la card. Existe para el caso descripto
abajo (rollout) — una pantalla cuyo contenido YA trae su propio padding puede pasar
`padded={false}` y aportar el suyo, en vez de terminar con el doble.

## Rollout — no es un reemplazo mecánico uniforme

Pedido explícito del usuario: antes de envolver una pantalla en `ScreenCard`, hay
que mirar qué tiene hoy. Tres casos reales, no uno solo:

1. **Sin ningún wrapper propio** (la mayoría) — se agrega `ScreenCard` fresco,
   `padded` default.
2. **Ya tiene ALGÚN wrapper con su propio padding** (ej. ya usa `SectionCard` u
   otro contenedor con `p-4` propio alrededor de todo) — `ScreenCard` **reemplaza**
   ese wrapper, no se anida arriba (padding duplicado = demasiado espacio vacío,
   bug real a evitar). El contenido interno conserva su padding existente,
   `ScreenCard` entra con `padded={false}`.
3. **`team-detail-screen.jsx`** — ya tiene exactamente este patrón a mano (el caso
   que originó todo esto). Se migra su `team-detail-screen-container` a usar
   `ScreenCard` en vez de las clases sueltas, por consistencia — no por necesidad
   visual (ya se ve bien), para que quede un solo lugar de verdad.

El plan de implementación decide, pantalla por pantalla, a cuál de los tres casos
corresponde cada una — no se puede asumir de antemano sin mirar el código real de
cada una.

## Verificación

Sin tests de render de componentes (convención ya establecida del repo, ver
CLAUDE.md sección Testing) — verificación manual en preview web + device, como
toda la demás verificación visual del proyecto. `npm test`/`npm run lint` en verde
en cada paso igual (no deberían verse afectados por cambios puramente visuales,
salvo que `local/require-native-id` reaccione a los nuevos elementos de
`ScreenCard` — cumplir esa regla desde el primer commit del componente).

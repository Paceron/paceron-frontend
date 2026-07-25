# Cards de sección en formularios — Design

**Fecha:** 2026-07-14
**Estado:** Aprobado, pendiente de implementación (sin plan formal — diseño acotado, implementación directa)

## Contexto

`ProfileScreen` (`components/profile/profile-screen.jsx`) ya agrupa sus datos
en cards visuales (borde, sombra, ícono + título) vía un componente `Card`
local a ese archivo. `RegisterScreen` (`components/auth/register-screen.jsx`)
agrupa sus campos en secciones plegables (`SectionCollapsible`, local a ese
archivo) que solo usan una línea divisoria como separador, sin estilo de
card. `EditProfileScreen` (`components/profile/edit-profile-screen.jsx`) ni
siquiera separa visualmente — usa un `SectionTitle` de texto plano entre
grupos de campos.

Se unifica la apariencia: las tres pantallas pasan a usar un mismo
componente de card de sección.

## Alcance de esta spec

`components/auth/register-screen.jsx`, `components/profile/edit-profile-screen.jsx`,
`components/profile/profile-screen.jsx`, y un nuevo componente compartido
`components/forms/section-card.jsx`. Solo cambios visuales/estructurales —
ninguna validación, campo, ni lógica de submit cambia.

## Decisiones

### Componente compartido `SectionCard`

Nuevo archivo `components/forms/section-card.jsx`, junto al resto de los
building blocks de formularios (`Row`, `Col`, `InputField`, etc. en
`components/forms/fields.jsx`).

```
SectionCard({ title, icon, children, collapsible = false, collapsed = false, onToggle })
```

- Caja: `rounded-2xl border border-slate-200 bg-white p-6 shadow-sm
  dark:border-slate-800 dark:bg-surface` (mismas clases que el `Card` actual
  de `ProfileScreen`).
- Header: ícono (`MaterialCommunityIcons`, color `colors.primary`) + texto
  título (`text-base font-bold`), igual que hoy en `ProfileScreen`.
- Si `collapsible` es `false` (default): header es un `View` estático,
  `children` siempre visible.
- Si `collapsible` es `true`: header es un `Pressable` (`onPress={onToggle}`),
  con un chevron animado a la izquierda del ícono/título (mismo patrón que el
  `SectionCollapsible` actual de `RegisterScreen`: `rotateAnim` vía
  Reanimated, `interpolate` de 0 a -90deg). `children` solo se renderiza si
  `!collapsed`.
- No incluye `FieldGrid` — cada consumidor decide cómo laya sus `children`
  (esto lo mantiene usable tanto para el grid de solo-lectura de
  `ProfileScreen` como para los `Row`/`Col` de los formularios, que son
  layouts distintos).

### `ProfileScreen`

El `Card` local actual se reimplementa como un wrapper delgado sobre
`SectionCard` (agrega su `FieldGrid` interno alrededor de `children`). Sin
cambio visual ni de comportamiento — mismo output que hoy, solo se
recuesta sobre el componente compartido en vez de duplicar el markup.

### `EditProfileScreen`

Los dos grupos existentes se envuelven en `SectionCard` **no colapsable**:
- "Datos personales" (incluye teléfono/teléfono de contacto, igual que
  hoy — no se reagrupan campos) → ícono `account-details`.
- "Dirección" → ícono `map-marker`.

El `SectionTitle` (texto plano con borde inferior) que se usaba antes para
estos dos grupos se elimina — ya no hace falta, lo reemplaza `SectionCard`.
La sección ámbar "Datos de entrenador" (agregada en una spec anterior) no
cambia — sigue con su estilo propio (danger-zone-like en ámbar), no se
convierte en `SectionCard`.

### `RegisterScreen`

`SectionCollapsible` (componente local) se elimina, reemplazado por
`SectionCard collapsible` en los 3 usos existentes:
- "Datos personales" → ícono `account-details`.
- "Dirección" → ícono `map-marker`.
- "Contraseña" → ícono `lock-outline`.

Mismo comportamiento de plegado que hoy: cada sección se expande/contrae
de forma independiente (no es acordeón exclusivo), estado en
`collapsedSections` sin cambios. Las cards de sección quedan **anidadas
dentro** de la caja blanca grande que ya envuelve todo el formulario
(header con logo/título/"Volver" incluido) — esa caja exterior no se
elimina.

## Fuera de alcance

Reagrupar campos de `EditProfileScreen` para que coincida 1:1 con las 3
cards de `ProfileScreen` (personales/dirección/contacto separados) — se
mantienen los 2 grupos actuales, explícitamente decidido así. Cualquier
cambio de validación, campos, o lógica de submit en cualquiera de las tres
pantallas.

## Verificación

Web preview:
1. `/register`: las 3 secciones se ven como cards (borde/sombra/ícono),
   cada una plegable independientemente, mismo comportamiento de plegado
   que antes. La caja grande exterior sigue ahí.
2. `/profile/edit`: "Datos personales" y "Dirección" ahora se ven como
   cards con ícono, igual estilo visual que las cards de `/profile`. La
   sección ámbar de entrenador no cambia.
3. `/profile`: sin cambios visuales (mismo output que antes del refactor).

`npm test` → 32/32 verde (ningún test cubre estos componentes visuales,
por convención del proyecto).

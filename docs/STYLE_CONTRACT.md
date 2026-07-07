# Style Contract — Convenciones de UI

Este documento describe las reglas visuales que deben seguir todos los componentes del frontend.

---

## Colores

| Token | Clase Tailwind | Uso |
|---|---|---|
| `primary` | `primary` / `bg-primary` | Botones principales, links, indicadores activos |
| `onPrimary` | `text-[#111518]` | Texto sobre primary |
| `background` | `bg-white` / `dark:bg-[#0d1013]` | Fondo de pantalla |
| `surface` | `bg-white` / `dark:bg-[#111518]` | Fondo de tarjetas y paneles |
| `surfaceContainerHigh` | `bg-slate-50` / `dark:bg-[#282d31]` | Contenedores secundarios |
| `outlineVariant` | `border-slate-200` / `dark:border-slate-800` | Bordes de inputs y cards |
| `onSurface` | `text-slate-900` / `dark:text-white` | Texto principal |
| `onSurfaceVariant` | `text-slate-500` / `dark:text-slate-400` | Texto secundario |

---

## Bordes

- **Inputs:** `rounded-xl` (12px), border cuando no-error: `border-slate-200 dark:border-slate-700`, error: `border-red-400 dark:border-red-800`
- **Cards:** `rounded-2xl` (16px), `border border-slate-200 dark:border-slate-800`
- **Botones principales:** `rounded-full`, `bg-primary`, texto `text-[#111518]`
- **Botones secundarios:** `rounded-full`, `border border-slate-200 dark:border-slate-700`, `bg-white dark:bg-[#111518]`
- **Input web:** siempre incluir `outline-none` para evitar outline nativo del navegador
- **Modal dropdowns:** `rounded-2xl`, `border-slate-200 dark:border-slate-700`, `bg-white dark:bg-[#1d2125]`

---

## Espaciado

- **Gutter de pantalla:** `px-4` (16px)
- **Card padding:** `p-5` (20px) — excepciones: `p-6` (24px) para landing destacados
- **Gap entre elementos de formulario:** `mb-5` (20px)
- **Gap entre secciones:** `gap-5` (20px)
- **Header:** `h-[60px]`, `border-b`
- **Altura de inputs:** `h-12` (48px)
- **Avatar:** `h-10 w-10` (40px), `rounded-full`

---

## Sidebar

- **Expanded:** `w-72` (288px), texto visible + iconos `gap-3`
- **Compact (colapsada):** `w-16` (64px), solo iconos centrados, sin texto
- **Item activo:** `border-l-4 border-primary bg-primary/10`
- **Item hover (web):** `hover:bg-slate-100 dark:hover:bg-slate-800`
- **Padding items:** `px-3 py-2.5`
- **Toggle:** en la sección del usuario (arriba), icono `menu-open` / `menu`

---

## Tipografía

| Uso | Clases |
|---|---|
| Título de pantalla | `text-2xl font-bold text-slate-900 dark:text-white` |
| Subtítulo / descripción | `text-sm text-slate-500 dark:text-slate-400` |
| Label de campo | `mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200` |
| Texto de input | `text-sm text-slate-900 dark:text-white` |
| Placeholder | `text-slate-400 dark:text-slate-500` |
| Error | `mt-1.5 text-xs text-red-500 dark:text-red-400` |
| Eyebrow | `text-xs font-semibold uppercase tracking-[0.24em] text-slate-500` |

---

## Animaciones

- **Drawer slide:** 280ms, `Easing.out(Easing.cubic)`
- **Fade-in de pantalla:** 350ms, `Easing.out(Easing.cubic)`
- **Modal dropdown:** `animationType="fade"`, sin animación de slide

---

## Layout

- **Web max-width:** `max-w-4xl` (896px) para formularios, `max-w-5xl` (1024px) para landing
- **Sidebar + content:** `flex-row`, sidebar izq, content flex-1
- **Header centrado:** `justify-center` — el botón de menú se posiciona con `absolute` a la izquierda
- **Register 2 columnas web:** `flex-row gap-6`, cada columna `flex-1`

---

## Password validators

- **StrengthBar:** siempre visible en register, no se usa en login
- **RequirementRow:** siempre visible en register, no se usa en login
- **Checks:** `PASSWORD_REQUIREMENTS` (longitud, mayúscula, minúscula, número, especial, no común)

---

## Simulación (dev-only)

- `useAuthStore().isSimulatedLoggedIn` — solo en `__DEV__`
- Secciones condicionales se envuelven en `{__DEV__ && (...)}`
- Roles disponibles: `entrenador`, `corredor`

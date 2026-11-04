# Profundidad del widget de competencias — filtros, foco y subtabs de historial

**Rama:** `feature/runner-competitions-widget` (continúa el trabajo ya mergeado de
`docs/superpowers/specs/2026-11-02-runner-competitions-widget-design.md`).

## Contexto

Tras el widget del home y la pestaña cross-equipo del hub de gamificación, 3 mejoras
pedidas:

1. Las boxes del home pasan a ser el botón en sí (sin CTA "Ver" separado), navegan
   al equipo y hacen foco visual en la competencia clickeada — en las dos
   plataformas, con un destello de 4 segundos.
2. `CompetitionsTab` (pestaña de un equipo) gana filtros (tipo + rango de fechas),
   con una UI nueva: un botón que expande/contrae un form client-side contenido
   dentro del mismo marco con borde que ya enmarca las subtabs.
3. La pestaña "Competencias" del hub de gamificación (`MyCompetitionsTab`) se parte
   en dos subtabs (Activas / Historial), con el MISMO mecanismo de subtabs+filtros
   que el punto 2 (equipo + tipo + fecha, sin filtro de equipo en el caso de
   `CompetitionsTab` porque ya está adentro de uno).

## Alcance

Solo frontend. Confirmado que no hace falta ningún cambio de backend:

- El filtrado (tipo, equipo, rango de fechas) es 100% client-side sobre datos que
  ya se piden hoy sin filtro de status (`useCompetitions`/`useMyCompetitions`) —
  `type`, `startAt`, `endAt`, `teamId` ya vienen en el modelo normalizado
  (`services/normalizers.js#toCompetitionModel`), confirmado por uso real ya
  existente en `utils/competition-sort.js`/`competition-title.js`.
- El foco/destello es routing + UI, no pide nada nuevo al servidor.
- **No se agrega ninguna entrada a `docs/BACKEND_API_GAPS.md`** — no hay gap. Si se
  pregunta por qué no quedó una referencia corta como las demás: no hace falta,
  nada de esto depende de un cambio de backend.

## A. Home — las boxes son el botón

**`components/home/competitions-preview-card.jsx`:**

- `PreviewBox` deja de tener un `Pressable` interno con el label "Ver" — el `View`
  raíz de la box pasa a ser el `Pressable` (mismo `className` que hoy, se le suma
  `hover:opacity-90 active:opacity-90`). El ícono de tipo (`flag-checkered`/
  `trophy-variant`) queda como único acento visual de que es clickeable, más un
  `chevron-right` chico al final de la fila de equipo/estado (reemplaza el botón,
  no es otro botón — es parte del mismo Pressable).
- `onPress` pasa a navegar con el id de foco: `router.push(\`/teams/${competition.
  teamId}?tab=competencias&focus=${competition.id}\`)`.
- Nueva pieza al final de la lista (4ta posición, nunca se cuentan como una de las
  3 competencias): un `ViewAllTile`, mismo alto que las boxes en modo ancho (columna
  angosta al lado, `w-24` o similar, ícono `dots-horizontal-circle-outline` +
  "Ver todas") y una fila angosta propia en modo apilado (ícono + "Ver todas las
  competencias" + chevron). `onPress`:
  ```js
  const setAchievementsTab = useAchievementsTabStore((s) => s.setActiveTab);
  // ...
  onPress={() => { setAchievementsTab('competitions'); router.push('/achievements'); }}
  ```
  (confirmado: `store/achievements-tab-store.js#useAchievementsTabStore`, con
  `activeTab`/`setActiveTab` — el mismo que ya usa `achievements-screen.jsx` para
  recordar la última pestaña entre renders. No crear un store nuevo).
- Se muestra siempre que haya al menos 1 competencia activa (el tile de "ver todas"
  no cuenta para ese mínimo — si `preview.length === 0` sigue sin renderizar nada,
  igual que hoy).

**`components/achievements/my-competitions-tab.jsx`:** `CompetitionRow`'s
`numberOfLines={1}` del título pasa a `numberOfLines={3}` (mismo valor que ya tiene
`competitions-preview-card.jsx` desde el commit anterior) — incluida por el pedido
explícito de subir el clamp donde haga falta.

## B. Componente nuevo compartido — `FilterableSubtabs`

**Archivo nuevo:** `components/shared/filterable-subtabs.jsx`.

Por qué un componente nuevo: el punto C (equipo) y el punto D (gamificación) piden
el MISMO mecanismo visual/interacción (pedido explícito: "deben ser iguales... con
los filtros también contenidos") — subtabs + un botón que expande un form de
filtros client-side, todo contenido dentro de un único marco con borde. Construirlo
dos veces sería la duplicación exacta que el resto del repo evita (ver
`SectionCard`/`ScreenCard` como precedente de extraer en vez de repetir).

```jsx
export function FilterableSubtabs({
  tabs, active, onChange, badges, scope,       // van directo a <TabBar variant="compact">
  filterCount = 0,                               // cuántos filtros están aplicados, para el badge del botón
  filterContent,                                 // los campos del form (JSX), ya armados por el caller
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View className="mb-4 rounded-xl border-b-2 border-slate-300 dark:border-slate-700" nativeID={`${scope}-frame`} testID={`${scope}-frame`}>
      <View className="flex-row items-center gap-2 px-3 py-1.5" nativeID={`${scope}-row`} testID={`${scope}-row`}>
        <TabBar active={active} badges={badges} onChange={onChange} scope={scope} tabs={tabs} variant="compact" wrapClassName="flex-1 flex-row gap-4" />
        <Pressable
          accessibilityLabel={expanded ? 'Ocultar filtros' : 'Mostrar filtros'}
          className="flex-row items-center gap-1 rounded-full px-2.5 py-1 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID={`${scope}-filter-toggle`}
          onPress={() => setExpanded((v) => !v)}
          testID={`${scope}-filter-toggle`}
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="filter-variant" size={18} />
          {filterCount > 0 && (
            <Text className="text-xs font-semibold text-primary" nativeID={`${scope}-filter-count`} testID={`${scope}-filter-count`}>{filterCount}</Text>
          )}
        </Pressable>
      </View>
      {expanded && (
        <View className="px-3 pb-3" nativeID={`${scope}-filter-panel`} testID={`${scope}-filter-panel`}>
          {filterContent}
        </View>
      )}
    </View>
  );
}
```

Puntos clave de la implementación (no placeholders, completar con el código real al
escribir el archivo, usando `useThemeColors`/`MaterialCommunityIcons`/`Pressable`/
`View`/`Text` ya importados como en el resto del repo):

- El `border-b-2 border-slate-300 dark:border-slate-700` es el mismo valor que hoy
  vive en `VARIANT.compact.wrapClassName` de `components/shared/tab-bar.jsx` —
  se MUEVE a este contenedor nuevo. `TabBar` sigue existiendo tal cual, sin tocar
  su archivo: el override ya existe (`wrapClassName` es prop, confirmado leyendo
  el componente) y acá se le pasa uno "pelado" (`flex-1 flex-row gap-4`, sin
  `rounded-xl border-b-2 ...`) para que el borde no se dibuje dos veces.
- Arranca cerrado (`expanded = false`) siempre — ninguna de las dos pantallas
  necesita recordarlo entre renders/navegaciones.
- `filterCount` es responsabilidad del CALLER (cuenta cuántos de sus propios
  filtros tienen valor), este componente solo lo muestra.

## C. `CompetitionsTab` (equipo) — filtros de tipo y fecha

**Archivo:** `components/team/competitions-tab.jsx`.

- `competitions-tab.jsx` ya vive dentro de un `SectionCard` (`scope=
  "competitions-tab-root"`, `variant="nested"`, el botón "Nueva competencia" en su
  `headerRight`, junto al título "Competencias" -- cambio de otra rama, 2026-11-01,
  NO TOCAR esa parte). Lo que cambia es el bloque interno
  `<View className="mb-4"><TabBar active={subTab} .../></View>` (dentro del
  `SectionCard`, debajo de ese header) -- pasa a ser
  `<FilterableSubtabs active={subTab} badges={{ pending: listByTab.pending.length
  > 0 }} filterContent={...} filterCount={...} onChange={setSubTab} scope=
  "competitions-tab-subtabs" tabs={SUB_TABS} />` (mismos `tabs`/`active`/`onChange`/
  `badges`/`scope` que ya le pasaba a `<TabBar variant="compact">`, ahora a través
  de `FilterableSubtabs`). `filterContent` son los 2 campos de abajo.
- Estado de filtros, local al componente (`useState`): `{ type: '', from: '', to:
  '' }`. `type`: `ResponsiveSelectField` con opciones `[{id:'metric', name:'Por
  métrica'}, {id:'route', name:'Por trayectoria'}]` + el placeholder "Todos los
  tipos" ya cubre el caso vacío (mismo patrón que `PAYMENT_TYPE_FILTER_OPTIONS`).
  `from`/`to`: dos `DateField` en una fila propia (`flex-row gap-3`, cada uno
  `flex-1 min-w-0`, mismo motivo documentado en CLAUDE.md para los rangos del
  dashboard: `Row`/`Col` no alcanza para 50/50 en cualquier ancho) — ESTA fila
  ya es "inline en cualquier plataforma" por construcción (no depende de
  `isWeb`/`isNarrowWeb`), que es lo pedido para mobile.
- `filterCount` = cuántos de `type`/`from`/`to` tienen valor no vacío (0 a 3, pero
  `from`/`to` cuentan juntos como "rango" o cada uno suelto — simplicidad: contar
  cada campo no vacío individualmente, 0-3).
- El filtrado por tipo/fecha se aplica ANTES de separar por subtab de status: la
  lista completa del equipo (`competitions`, ya traída por `useCompetitions`) se
  filtra por `type`/`from`/`to` primero, y recién sobre ese resultado se separa
  en `listByTab.pending`/`active`/`finished` (la lógica que ya existe para armar
  `listByTab` no cambia de forma, solo recibe la lista ya filtrada en vez de la
  cruda).
- **Sin filtro de equipo** — confirmado explícitamente, ya está adentro de uno.

## D. `MyCompetitionsTab` (gamificación) — subtabs Activas/Historial + filtros

**Archivo:** `components/achievements/my-competitions-tab.jsx`.

- Usa el MISMO `FilterableSubtabs` del punto B. `tabs`: `[{id:'active_tab',
  label:'Activas', icon:'sword-cross'}, {id:'history_tab', label:'Historial',
  icon:'archive-outline'}]` (nombres de id con sufijo `_tab` para no chocar con
  `competition.status === 'active'`, que es otro valor en otro lugar).
  `filterContent`: equipo + tipo + fecha (3 campos, a diferencia de C que no
  tiene equipo).
- **División Activas/Historial, por `status`:**
  - Activas: `status` en `['active', 'pending_approval']` — todavía no cerrada.
  - Historial: `status` en `['finished', 'rejected']` — cerrada, en cualquier
    desenlace. (Nada de "pendientes" sueltas: no hay una 3ra categoría, el pedido
    fue explícito en que no tiene sentido una subtab de pendientes acá.)
- Filtro de equipo: `ResponsiveSelectField` con las opciones de
  `useMyMemberTeams` (mismo hook que ya usa `useMyCompetitions` internamente) +
  placeholder "Todos los equipos". Tipo y fecha, igual que en C.
- Orden dentro de cada subtab: el mismo que ya define
  `sortCompetitionsForList` (`utils/competition-sort.js`, sin tocar) — aplicado
  sobre el resultado YA filtrado por equipo/tipo/fecha, no sobre la lista cruda.
- `useMyCompetitions` sigue llamándose sin el param `status` (trae todo, como ya
  hace hoy) — el recorte Activas/Historial + los filtros nuevos son 100%
  client-side sobre ese resultado único.

## E. Foco + destello — cross-platform, reusable

**Archivo nuevo:** `hooks/use-scroll-to-highlight.js`. Pensado desde el día uno
para reusarse en el futuro mecanismo de onboarding (pedido explícito) — por eso no
vive adentro de `competitions-tab.jsx`, es un hook genérico.

```js
export function useScrollToHighlight(targetId, scrollViewRef) {
  const [highlightedId, setHighlightedId] = useState(null);
  const rowRefs = useRef({});

  const registerRow = (id) => (el) => { rowRefs.current[id] = el; };

  useEffect(() => {
    if (!targetId) return;
    const node = rowRefs.current[targetId];
    if (!node) return;

    if (isWeb) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (scrollViewRef?.current) {
      node.measureInWindow((x, winY) => {
        scrollViewRef.current.measureInWindow((sx, scrollWinY) => {
          scrollViewRef.current.scrollTo({ y: winY - scrollWinY - 80, animated: true });
        });
      });
    }

    setHighlightedId(targetId);
    const timer = setTimeout(() => setHighlightedId(null), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  return { registerRow, highlightedId };
}
```

- **4 segundos exactos, en las dos plataformas** — pedido explícito, no 2s como se
  había sugerido antes de confirmar.
- **`measureInWindow`, nunca `measureLayout`** para el camino nativo — el mismo
  motivo ya documentado en CLAUDE.md ("Quirks conocidos"): `measureLayout` puede
  fallar en silencio bajo New Architecture/Fabric. El offset fijo de `80` (debajo
  del header fijo de la pantalla) es un valor de partida, ajustar en preview/
  device si queda tapado por el header de `team-detail-screen.jsx`.
- **`scrollViewRef` es responsabilidad de quien monta la pantalla**, no de este
  hook ni de `CompetitionsTab`: confirmado que `team-detail-screen.jsx` (su
  `<ScrollView>` raíz, línea ~1039) NO tiene `ref` hoy -- agregar
  `const scrollViewRef = useRef(null)` + `ref={scrollViewRef}` ahí, y pasarlo
  como prop a `competitionsContent`/`<CompetitionsTab>` únicamente (sin tocar el
  resto del comportamiento del `ScrollView`).
- **Destello visual** (no un dim del resto de la pantalla, descartado en el
  brainstorming): la fila con `competition.id === highlightedId` reemplaza su
  clase de fondo normal (nested, `bg-slate-200/50 dark:bg-slate-800/60`) por un
  tono ámbar de aviso temporal (`bg-amber-100 dark:bg-amber-900/30`, MISMO par que
  ya usa el repo para estados de "atención" puntual — ver `dashboard-quality-
  callout`/`SectionCard variant="amber"`) durante la ventana de 4s, con
  `transition-all` para que la vuelta al tono normal no sea un corte brusco.
- **`CompetitionRow` (ambas pantallas, C y D) necesita el `ref` de
  `registerRow(competition.id)` en su `View` raíz** para que el hook pueda
  encontrarla — único cambio estructural que D y C comparten más allá de
  `FilterableSubtabs`.
- `focus` llega como query param (`useLocalSearchParams`, ya usado en el resto de
  la app) solo a `CompetitionsTab` (vía el deep link de la sección A) — no a
  `MyCompetitionsTab`, que no tiene ningún origen que le pase un id puntual hoy.
  Al recibir `focus`, `CompetitionsTab` primero fuerza la subtab activa a la que
  corresponda el `status` de esa competencia (si no está ya en esa subtab), ANTES
  de que el hook intente encontrar la fila (si la fila no está montada todavía
  porque la subtab no coincide, `rowRefs.current[targetId]` da `undefined` y el
  efecto no hace nada).

## Testing

- Sin tests de render (convención del repo). Lo testeable con Jest puro: la
  partición Activas/Historial por status (si se extrae a una función en
  `utils/competition-sort.js` o se deja inline — si es una función nueva,
  nombrarla y testearla igual que `sortCompetitionsForList`).
- Verificación manual en preview: expandir/contraer el panel de filtros en los
  2 lugares, confirmar que el borde queda contenido (sin doble borde ni hueco),
  filtrar por tipo/fecha y confirmar que recorta bien, click en una box del home
  y confirmar que cae en la subtab correcta con el destello visible.
- El camino nativo del scroll (`measureInWindow` + `scrollTo`) no se puede probar
  en el preview web — mismo límite de siempre, queda pendiente de confirmación en
  device real.

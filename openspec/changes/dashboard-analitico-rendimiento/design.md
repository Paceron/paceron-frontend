# Design

## Context

Estado actual que condiciona el diseño. La motivación está en `proposal.md` — Why.

**Lo que ya existe y se reusa:**

- `react-native-svg@15.12.1` está instalado (`package.json:69`) y ya se usa para gráficos a mano: `components/profile/payments-monthly-chart.jsx`, con la geometría testeada en `utils/payments-chart.js`, y `components/session-runtime/trajectory-sketch.jsx` con `utils/trajectory.js`.
- El stack de export ya está resuelto: `expo-print` + `expo-sharing` en nativo, y `services/receipt.web.js` para el camino web con `iframe srcdoc` + `contentWindow.print()`.
- Los tokens están centralizados: `theme/tokens.js` (`LAYOUT`, `RADIUS`, `SPACING`, `Z_INDEX`, `ANIMATION`, `BREAKPOINTS`) y `tailwind.config.js` para colores.
- El polling no es nuevo: `hooks/use-pull-to-refresh.js` ya existe para el gesto, y `lib/query-client.js` centraliza la cache con `staleTime: 60_000`.
- El patrón de estados y `aria` de referencia es `components/forms/searchable-picker-field.jsx` — el archivo con más a11y del repo (22 ocurrencias), que usa el doble patrón `accessibilityState` nativo + alias `aria-*` plano porque `react-native-web@0.21` no implementa `accessibilityState`.

**Quirk conocido que condiciona el PDF:** la implementación web de `expo-print` es `window.print()` e ignora el HTML — imprimiría la aplicación entera, no el documento. Por eso web y nativo necesitan caminos distintos, ya implementados en `services/receipt.web.js`.

**Restricción del proyecto:** no hay tests de render de componentes (convención declarada en `CLAUDE.md`). `@testing-library/react-native` **sí** está instalado y se usa con `renderHook`, pero no hay render de componentes visuales. La cobertura del front sale de funciones puras en `utils/`.

## Goals / Non-Goals

**Goals:**

- Que la geometría de cada gráfico viva en una **función pura testeable** (`utils/dashboard-chart.js`), igual que `utils/payments-chart.js`. Sin esto, ningún gráfico tiene cobertura.
- Que ninguna fórmula de KPI se recalcule en el front.
- Que la conmutación entre casos de paleta no desmonte y remonte la pantalla.

**Non-Goals:**

- No se introduce librería de gráficos. Es la decisión que sostiene el budget de bundle y encaja con lo que ya hay.
- No se toca el design system. La estética futurista sale de tokens existentes.
- No se implementa WebSocket.

## Decisions

### D1: Geometría de gráficos en funciones puras

Cada gráfico calcula sus coordenadas en `utils/dashboard-chart.js`, sin React. El componente solo pinta.

Es el mismo criterio que ya aplicaron con `utils/payments-chart.js`: la geometría es lo que tiene bugs (ejes, escalas, NaN cuando todos los valores son iguales) y es testeable sin render.

**Alternativa descartada:** calcular dentro del componente con `useMemo`. Sería menos código, pero dejaría la parte con más chances de error sin una sola prueba.

### D2: Sin librería de gráficos

`react-native-svg` ya está y hay dos implementaciones de referencia. Agregar Recharts o similar rompería el budget de `+80 KB gzip` (Recharts por sí solo pesa más que ese presupuesto completo) y traería un modelo de props incompatible con NativeWind.

### D3: Tres casos de paleta, dos componentes

**A completo** y **B** no comparten estructura: A tiene gauge y bullet chart, B tiene un número grande y dot plots. Forzarlos en un componente con props condicionales produce un componente con la mitad del árbol muerto en cada uso.

**A reducido** es el tercer caso y no es una variante de A: tiene numero principal y cumplimiento, pero **no** gauge de ritmo ni velocidad esperada, porque `target_speed_kph` es `null`. Se resuelve **envolviendo A completo y ocultando las piezas de ritmo**, no con un tercer contenedor: las piezas compartidas (cumplimiento, delta, evolucion) son las mismas, y duplicarlas es la via directa a que las dos se desincronicen.

Se renderiza uno u otro. La conmutación conserva el contenedor y los KPIs: solo cambia la región de gráficos, para no perder el scroll ni provocar salto de layout.

### D4: Las unidades vienen de la API

Todo KPI se muestra con la unidad que la API declara. La misma magnitud se expresa en minutos o segundos según la duración; hardcodear el sufijo en el componente mostraría unidades equivocadas sin que nada falle.

### D5: `null` es "—", nunca `0`

`Number(null) === 0` y eso pasa un `Number.isFinite` — el mismo bug que se evitó en `utils/currency.js#formatArs` con "un monto no cargado no es $0". En el dashboard el stakes es peor: un `0` de cumplimiento se lee como "no cumplió nada" cuando en realidad no se midió.

### D6: La diferencia de cumplimiento en puntos porcentuales

64 % → 58 % es **−6 pp**, no −9,4 %. El porcentaje relativo exaggera las caídas y subestima las subidas cerca de valores altos. Es también lo que devuelve la API.

**Alternativa descartada:** porcentaje relativo por ser más "intuitivo". Es el número que confunde a quien lo lee.

### D7: Sondeo, no WebSocket

El WS del repo publica por sesión (`session_{id}`), no por scope de dashboard. Agregar un canal por usuario es trabajo de backend y de infraestructura de broadcast para un agregado que no cambia en milisegundos.

60–120 s con TanStack Query: la cache ya está centralizada y `staleTime` hace el resto.

**Detalle importante:** el sondeo **no** debe volver al estado de carga. Un skeleton en cada ciclo de 60 s haría la pantalla inusable. Se actualiza en segundo plano.

### D8: Exportación desde el cliente

El CSV y el PDF se arman desde la respuesta que la pantalla ya tiene. Un endpoint de export duplicaría la definición de columnas en dos lugares y divergiría de la pantalla sin que nada avise.

El PDF en web usa el camino de `services/receipt.web.js` porque `expo-print` web no sirve para HTML propio.

### D9: El filtro de tipo es un tablist real

El selector de tipificación es visualmente un grupo de botones, y semánticamente es un `tablist`. Se implementa con `accessibilityRole="tab"` / `aria-selected` y roving `tabIndex`, siguiendo el patrón de `tab-bar.jsx`.

**Restricción verificada:** `accessibilityRole="tablist"` y `"tab"` **existen** en la lista de TalkBack; `tabpanel` **no existe** y requiere el prop crudo `role`. Cualquier test nuevo de roles tiene que respetar eso o rompe la app en Android.

### D10: Paleta de color por significado, no por tipo

La paleta de gráficos cambia por la tupla `(has_target, axis, target_speed_kph != null)` de la respuesta, no por el tipo. La paleta de **color** no: verde = mejoró, ámbar = estable, rojo = empeoró. Mismo criterio semántico en toda la app —ámbar es "te falta hacer algo", rojo es destructivo— para que el color signifique lo mismo en el dashboard que en el resto.

### D11: Comparación de dos ejecuciones, agregada por el backend

La comparación actual de períodos se conserva. La nueva comparación de sesiones es un segundo modo dentro de la pestaña `Comparación`, y selecciona dos ejecuciones concretas (`A` y `B`), no dos agregados de fecha. El rango propio de A/B no se hereda ni modifica el rango global del dashboard.

El comparador tiene un **rango de fechas propio**, común a A y B porque el endpoint recibe una única ventana. Se inicializa con el rango real de datos de `/dashboard/filters`; modificarlo no cambia el período ni los KPIs del dashboard principal. Cambiar este rango limpia las sesiones elegidas y actualiza las opciones de ambos lados.

Cada lado elige un grupo, un corredor según el rol, un ejercicio del catálogo y una `SessionInstance` con feedback para ese ejercicio. Al elegir el ejercicio, la lista de sesiones candidatas se obtiene con el `GET /dashboard/exercises/{id}/series` ya existente, paginando las filas del ejercicio en ese grupo/corredor y el `from/to` propio del comparador, y agrupándolas por `session_instance_id` —la fecha es etiqueta, no clave, porque podría haber más de una instancia en el mismo día. Los filtros numéricos de distancia/tiempo del dashboard no restringen las opciones ni el detalle A/B: se comparan las series completas del ejercicio en cada sesión elegida. Solo se ofrecen ejercicios `role=main` y sesiones `finished`/`interrupted` o sin `runner_session` (histórico legacy); `wip`, calentamientos y vueltas a la calma quedan fuera como en el resto del dashboard.

El resumen y las series comparadas **no se agregan en React**. El frontend manda los dos lados al nuevo `POST /dashboard/comparisons/sessions`:

```json
{
  "team_id": 29,
  "from": "2026-07-20",
  "to": "2026-10-24",
  "a": { "group_id": 39, "athlete_user_id": 24, "session_instance_id": 501, "exercise_id": 8 },
  "b": { "group_id": 39, "athlete_user_id": 24, "session_instance_id": 527, "exercise_id": 8 }
}
```

El backend valida **cada lado** contra el team/group del solicitante, la membresía del corredor en la fecha de la sesión, el ejercicio congelado de esa instancia y el filtro `role=main`. El ejercicio del catálogo se resuelve por `source_exercise_id`, con el fallback de nombre normalizado y limitado al mismo owner para instancias legacy. El corredor solo puede comparar sesiones propias; el entrenador puede usar el modo mismo-corredor o dos corredores dentro del scope. El `session_instance_id` nunca se acepta como permiso por sí solo.

El response devuelve para A y B los metadatos de sesión, `series_count` (filas registradas), `valid_series`, distancia total, velocidad media ponderada por distancia, RPE medio en escala 1–10 con su muestra, mejor/peor serie y puntos por `set_number` para el gráfico. Los campos no calculables son `null`, no cero. El backend calcula las métricas y las reglas de mejor/peor según `kind`:

| Tipo | Mejor / peor serie |
|---|---|
| `ritmo_continuo` | menor / mayor tiempo activo (fallback a `duration_ms`), mostrando también la distancia realmente recorrida |
| `velocidad_distancia` | mayor / menor velocidad derivada de distancia y tiempo |
| `velocidad_tiempo` | mayor / menor distancia lograda dentro del tiempo prescrito |

La comparación de velocidad se expresa como `B.mean_speed_kph − A.mean_speed_kph`: positivo = ganó velocidad, negativo = perdió. La distancia se muestra por separado para A y B, con diferencia absoluta. El RPE medio es el dato adicional de esfuerzo y nunca se inventa si las series no lo traen.

#### Dirección visual

- Fondo y superficies usan los tokens actuales (claro `#FFFFFF`, oscuro `#111518`); A usa el verde Paceron `#8CC63E` y B un azul `#38BDF8`. La ganancia/pérdida conserva verde/rojo semánticos existentes; texto e icono acompañan siempre al color.
- La tipografía del producto permanece en controles y texto; `Orbitron_700Bold` se reserva para el delta central de velocidad, como cifra de rendimiento, no para todos los labels.
- El punto focal es un delta `B − A` grande entre los dos contextos, no un hero decorativo. A y B quedan alineados como una sola comparación.
- Los puntos y las barras son blancos interactivos: en web el hover revela el detalle sin cambiar el rango, y en mobile el toque lo deja visible. El tooltip de cada serie muestra contexto (A/B, ejercicio y fecha) más velocidad, distancia y tiempo; el de distancia muestra el total y el delta `B − A`.

```text
[ Sesiones A/B | Períodos ]
[ Mismo corredor | Dos corredores (solo entrenador) ]

┌ Sesión A: grupo · corredor · ejercicio · fecha ┐
┌ Sesión B: grupo · corredor · ejercicio · fecha ┐
                  [Comparar sesiones]
                 +0,8 km/h · B vs A

       Series por set: A (verde) / B (azul)
  Distancia total A vs B       Mejor / peor       RPE medio
```

En ancho los selectores de A y B se muestran en dos columnas y el delta las ancla al centro; en angosto se apilan A → delta → B, sin scroll horizontal. El gráfico compara velocidad por serie en un eje común; la distancia total se muestra en una pareja aparte, no en un doble eje confuso. La comparación por período existente permanece disponible en el segundo modo. No se agrega una librería de gráficos: se reutiliza `react-native-svg` y la geometría testeable de `utils/dashboard-chart.js`.

En mobile, el tab `Filtros` abre una hoja inferior segura para el área de sistema, con el formulario en scroll y cierre al aplicar, limpiar, tocar el fondo o usar atrás. El orden inicial deja las KPIs seguidas de la evolución del período, abierta; los otros gráficos muestran previews y el ranking permanece oculto detrás de su tab hasta que se solicite.

### D12: Selector de fecha único para el dashboard web/mobile

Los dos rangos de la pantalla —el global de filtros y el propio de la comparación A/B— SHALL usar el mismo `DashboardDateField`. El campo SHALL permitir escribir la fecha y abrir un calendario visual tanto en web como en mobile; no SHALL delegar el formato visible a `input[type=date]` ni variar entre plataformas. El rango inicial sale de `date_range`; si el historial completo supera 731 días, ambos formularios SHALL iniciar en la ventana más reciente aceptada por el backend.

El valor controlado y el texto mostrado SHALL ser `DD/MM/AAAA`. En el límite de la request, `services/dashboard.js` SHALL convertirlo a `YYYY-MM-DD` con `toISODate`; los componentes no SHALL construir ISO ni cambiar el formato visible para hablar con el backend. La fecha SHALL validarse como fecha real de calendario (incluidos años bisiestos); el rango SHALL rechazar fechas inválidas, `from > to` y ventanas mayores al máximo del endpoint (731 días) antes de consultar. En el rango global `to` puede seguir opcional como permite la API; A/B requiere ambos extremos.

Elegir un día en el calendario SHALL actualizar el campo en `DD/MM/AAAA`. Web y mobile SHALL compartir el mismo calendario, con navegación de mes, días accesibles por toque y teclado, foco visible y sin movimiento ornamental.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **La geometría de un gráfico tiene un bug que los tests no cubren** | Cada tipo de gráfico tiene su función pura con casos de borde: todos los valores iguales, un solo punto, rango cero, `null` en el medio |
| **La conmutación entre casos de paleta remonta la pantalla** y pierde scroll | Contenedor y KPIs estables; solo la región de gráficos cambia de subárbol |
| **El sondeo parpadea** | Se actualiza en segundo plano sin volver al skeleton; cubierto por la spec de estados |
| **El presupuesto de +80 KB gzip se rompe** | Los gráficos van en un módulo con carga diferida y `react-native-svg` ya está en el bundle base |
| **Un `null` renderizado como `0`** | Helper único de formato; test de render no disponible, así que la cobertura va en `utils/` |
| **El PDF web imprime la app entera** | Camino web aparte desde el inicio, no un afterthought |
| **El color solo transmite el significado** | Todo estado crítico lleva ícono y texto además del tono; la a11y del repo ya tiene el patrón |

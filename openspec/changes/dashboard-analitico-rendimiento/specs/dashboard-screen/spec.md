# Spec Delta

## Purpose

Pantalla de analítica de rendimiento: muestra las métricas que calcula la API de `/dashboard`, con paletas de gráficos que cambian según la tipificación del ejercicio y estados completos para carga, vacío, error y falta de permisos.

## ADDED Requirements

### Requirement: El sistema SHALL mostrar los estados obligatorios de la pantalla

La pantalla SHALL distinguir y mostrar siete estados: **carga** (skeleton con la forma del contenido definitivo, no un spinner centrado), **vacío** (con CTA que explica qué falta), **error transitorio** (con botón de reintento), **error de validación** (`400`, sin botón de reintento), **recurso inexistente** (`404`), **sin permisos** (`403`, explicando que el recurso está fuera de su scope, sin revelar si existe) y **primer uso** (una vez por usuario, guiando a elegir grupo y tipo de ejercicio).

El botón de reintentar SHALL aparecer **solo** en errores transitorios. Un `400` significa que la propia request está mal: reintentarla sin cambiarla vuelve a fallar igual, y ofrecer el botón produce un bucle. El `400` trae un `code` estable que la pantalla usa para explicar qué corregir y, si el error es del filtro, ofrecer **corregir el filtro** en vez de reintentar.

El skeleton SHALL ocupar la misma altura que el contenido final para no provocar salto de layout al resolver.

#### Scenario: Carga inicial

- **WHEN** se abre la pantalla y las consultas están en vuelo
- **THEN** se muestran esqueletos con la disposición definitiva, sin spinner y sin contenido real

#### Scenario: Sin datos en el período

- **WHEN** las consultas resuelven con cero series en el período
- **THEN** se muestra el estado vacío con el texto "No hay estadísticas disponibles aún" y un CTA que amplía el rango de fechas

#### Scenario: Falla de red

- **WHEN** la consulta falla por red o por un `5xx`
- **THEN** se muestra el mensaje del error y un botón de reintento que vuelve a pedir los datos

#### Scenario: Parámetro inválido

- **WHEN** la API responde `400` con `code: "INVALID_RANGE"`
- **THEN** la pantalla explica cuál filtro corregir y **no** ofrece reintentar la misma request

#### Scenario: Ejercicio inexistente

- **WHEN** la API responde `404` al pedir el detalle de un ejercicio
- **THEN** se explica que el recurso no existe y se ofrece volver al listado, sin botón de reintento

#### Scenario: Recurso fuera de scope

- **WHEN** la API responde `403`
- **THEN** se muestra el estado sin permisos, explicando que ese recurso no está en su scope, sin revelar si existe

### Requirement: El sistema SHALL alternar la paleta de gráficos según la tipificación del ejercicio

La pantalla SHALL ofrecer tres casos de paleta distintos y conmutar automáticamente al cambiar el tipo de ejercicio:

La paleta se decide por una **tupla de tres campos de la respuesta**, no por el tipo de ejercicio: `(has_target, axis, target_speed_kph != null)`.

Hacen falta los tres porque `has_target` solo no alcanza. Con `axis: "distance"` —un `velocidad_distancia` de 100 m, uno de los 4 del seed— hay objetivo **y** `has_target: true`, pero **no hay tiempo objetivo**, así que `target_speed_kph` viene `null`: la velocidad esperada es imposible de derivar de la distancia sola. Mostrar un gauge "ritmo vs objetivo" ahí sería inventar un objetivo que no existe.

| Caso | Condición | Número principal | Piezas de objetivo |
|---|---|---|---|
| **A completo** | `has_target` y `target_speed_kph != null` | **ritmo** (km/h), salvo `liviano`, que muestra **volumen** | gauge de ritmo, delta, cumplimiento, consistencia, evolución |
| **A reducido** | `has_target` y `target_speed_kph == null` (eje `distance`) | **distancia** (m) | cumplimiento por distancia, delta, evolución. **Sin** gauge de ritmo ni velocidad esperada |
| **B** | `has_target == false` | **mejor tiempo** (s) | ninguna: sin objetivo no hay contra qué comparar |

Los tres tipos con métrica son `ritmo_continuo`, `velocidad_distancia` y `velocidad_tiempo`. `liviano` y `elongacion` **no se ofrecen como filtro**: sus series son `warmup`/`cooldown` y nunca pasarían el filtro `role = 'main'` del backend.

`liviano` es la excepción al número principal: el tipo se define por **volumen, no por ritmo** (`utils/exercise-field-matrix.js:24-31`, `showSpeed: false`, sin ícono de velocidad). Mostrar 7,2 km/h como número principal de un calentamiento de 10 minutos sería medirlo con una vara que el producto no usa para ese tipo. Para `liviano`, el número principal es el **volumen** (distancia o tiempo, el que esté cargado) y las piezas de ritmo no se pintan.

Aplica a **2 de los 13 ejercicios del seed** (Velocidad Máxima 100/200 m, que no tienen tiempo objetivo) el caso A reducido; Pasadas 1000/2000 llevan `minutes`, así que son A completo. Ninguno de los 13 llega a la paleta B, así que esa se cubre por robustez —filas previas a la migración de tipos, o un ejercicio que el entrenador dejó incompleto— y no por el seed.

La pantalla SHALL **NOT** mostrar métricas de objetivo —delta, cumplimiento, ritmo esperado— para un ejercicio sin objetivo. Mostrarlas sería mostrar un cero como si fuera un resultado.

#### Scenario: Ejercicio con objetivo de ritmo

- **WHEN** la API devuelve `has_target: true` con `axis: "distance_and_time"` y `target_speed_kph` con valor
- **THEN** se muestran ritmo, delta y cumplimiento, y el número principal es el ritmo

#### Scenario: Ejercicio con objetivo solo de distancia

- **WHEN** la API devuelve `has_target: true` con `axis: "distance"` y `target_speed_kph` en `null`
- **THEN** el número principal es la distancia, aparece el cumplimiento por distancia, y **no** hay gauge de ritmo ni velocidad esperada

#### Scenario: Ejercicio sin objetivo cargado

- **WHEN** la API devuelve `has_target: false` para el ejercicio seleccionado
- **THEN** el número principal es el mejor tiempo, y no aparecen delta, cumplimiento ni ritmo esperado

#### Scenario: El objetivo ausente se detecta por el dato, no por el tipo

- **WHEN** un ejercicio de velocidad en tiempo vuelve `has_target: false` por no tener objetivo cargado
- **THEN** la pantalla usa la paleta B aunque el tipo sea "velocidad en tiempo"

#### Scenario: El cambio conmuta la paleta

- **WHEN** el usuario cambia a un ejercicio sin objetivo, o un objetivo se deja de cargar
- **THEN** la pantalla reemplaza el conjunto de gráficos, sin dejar gráficos del tipo anterior en pantalla

### Requirement: El sistema SHALL distinguir "no hay dato" de un cero

Cuando la API devuelva un campo como `null`, la pantalla SHALL mostrar un guion o estado "sin dato" y **NO** un cero. Un cero es un resultado legítimamente distinto de la ausencia de dato, y confundirlos hace que el usuario lea "cumplió cero" cuando en realidad no hay medición.

#### Scenario: Ejercicio sin series

- **WHEN** la API devuelve `delta_pct: null` y `compliance_rate: null`
- **THEN** la pantalla muestra "—" en esos campos, no `0 %` ni `0 km/h`

### Requirement: Los gráficos SHALL poder explorarse sin perder el conjunto

La pantalla SHALL mostrar los gráficos de la paleta en una grilla de **dos columnas** en viewport ancho y de **una columna** en viewport angosto. Cada tarjeta SHALL arrancar colapsada, mostrando su título y una **preview textual** en lugar del gráfico completo, y SHALL poder expandirse o colapsarse individualmente. La pantalla SHALL ofrecer una acción global para maximizar todos los gráficos de la grilla y otra para minimizarlos todos, y SHALL permitir tener uno, varios, todos o ninguno expandidos.

Expandir una tarjeta NO SHALL modificar el filtro ni la granularidad de las demás. Una tarjeta colapsada NO SHALL montar el SVG del gráfico completo: la preview es texto, no un gráfico reducido.

#### Scenario: Todos colapsados al abrir

- **WHEN** se abre la pantalla por primera vez
- **THEN** los gráficos aparecen en grilla de dos columnas en ancho, o de una en angosto, con sus previews, y ninguno está expandido

#### Scenario: Expandir varios

- **WHEN** el usuario expande dos tarjetas
- **THEN** las dos muestran el gráfico completo y las demás siguen colapsadas

#### Scenario: Maximizar y minimizar todos

- **WHEN** el usuario presiona "Maximizar todos"
- **THEN** todas las tarjetas de la grilla se expanden
- **WHEN** presiona "Minimizar todos"
- **THEN** todas se colapsan, incluso las que se habían expandido individualmente

### Requirement: El sistema SHALL exponer el estado de calidad de los datos

La pantalla SHALL mostrar el bloque `data_quality` que devuelve la API, con sus **seis** campos: series no calculables, tiempo degradado, estado de cumplimiento desconocido, sesiones sin cerrar, sesiones sin registro y volumen insuficiente.

`legacy_sessions` SHALL mostrarse como **nota al pie informativa**, nunca como advertencia, junto a un texto que aclare que esas series se incluyen igual en los KPI. Es el único contador del bloque que no es un defecto: sin esa aclaración, el usuario lo lee como "algo está mal" y busca un error que no existe.

Cuando `insufficient_data` sea verdadero, la pantalla SHALL ocultar los indicadores de tendencia y mostrar el motivo, en lugar de mostrar un porcentaje calculado sobre muy pocos datos.

El estado de calidad SHALL compartir panel con los filtros, como una **segunda pestaña al mismo nivel**, y no como un panel separado: son dos preguntas que se consultan juntas y dos tarjetas apiladas empujaban los gráficos. El panel SHALL arrancar minimizado y SHALL mostrar el conteo de avisos en el label de la pestaña de calidad, sin un badge combinado con los filtros. Abrir o cerrar una pestaña NO SHALL afectar a la otra. La pestaña SHALL existir aunque no haya avisos, y en ese caso su contenido SHALL decir que no hay avisos en el período, en vez de mostrar un recuadro ámbar vacío.

#### Scenario: Tendencia sin volumen suficiente

- **WHEN** la API devuelve `insufficient_data: true` y `trend_pct: null`
- **THEN** la pantalla no muestra flecha de tendencia ni porcentaje, y explica que hay datos insuficientes

#### Scenario: Calidad minimizada y sin avisos

- **WHEN** el panel está minimizado habiendo tres series no calculables
- **THEN** el label de la pestaña sigue diciendo "Calidad · 3 avisos", y el contenido de las dos pestañas está colapsado

- **WHEN** `data_quality` no trae ningún defecto, no hay `insufficient_data` ni `legacy_sessions`
- **THEN** la pestaña "Calidad" sigue existiendo y su contenido dice "Sin avisos de calidad en el período"

### Requirement: El sistema SHALL indicar la fuente de cada número

Todo KPI SHALL mostrar la unidad en la que está expresado —km/h, min, m, s— y SHALL ofrecer un tooltip con el detalle de cómo se calculó ese número, incluyendo la tolerancia aplicada y la cantidad de series usadas.

Las unidades SHALL venir del bloque `units` de la respuesta, y **solo de claves que el backend declare**: `speed` (km/h), `time` (ms), `distance` (m), `delta` (%), `compliance` (%), `best_time` (ms) y `percentage_point` (pp).

Los valores crudos llegan en **milisegundos** —`best_time_ms`, `time_ms`— y el front SHALL formatearlos a `m:ss` o `h:mm:ss` para mostrarlos. Esa conversión es **de formato, no de cálculo**: no cambia el valor, solo lo escribe. No existe clave `s` ni `min` en el contrato, y el front no puede inventar una ni convertir unidades por su cuenta.

`compliance_rate` llega en 0–100 y `compliance_pp` en puntos porcentuales: el front SHALL **no** multiplicar por 100 para mostrarlo.


#### Scenario: Tooltip de un KPI

- **WHEN** el usuario consulta el tooltip del ritmo promedio
- **THEN** ve la fórmula, la tolerancia efectivamente aplicada (`tolerance_applied`) y cuántas series entraron (`series_count`)

### Requirement: Cada card SHALL explicar qué muestra desde su título

Cada card con gráfico SHALL llevar un botón de información ("i") junto al título con la bajada de la card: qué muestra, cómo se lee y de dónde sale el número.

El texto SHALL ser alcanzable sin hover: en web el botón SHALL responder al puntero y al foco de teclado, y en nativo al toque —donde el tooltip de hover no existe y la "i" no puede quedar sin respuesta. En las dos plataformas el texto SHALL llegar además por `accessibilityHint`, o el gráfico queda mudo para un lector de pantalla.

El texto explicativo SHALL vivir en ese botón, no como subtítulo fijo. El subtítulo visibles SHALL quedar reservado a lo que hay que leer para entender el gráfico sin ningún gesto: la leyenda que distingue series (línea continua contra punteada) y el dato que condiciona la lectura (tolerancia aplicada, orden activo del ranking, rango comparado).

La bajada SHALL describir el gráfico y no recalcular nada: las fórmulas viven en el tooltip de cada KPI. SHALL respetar la paleta vigente — en A reducido no puede mencionar la velocidad esperada, que no está cargada.

#### Scenario: Bajada de un gráfico

- **WHEN** el usuario consulta el "i" del título de "Cumplimiento por período"
- **THEN** ve cómo se lee la card: qué es el área apilada, qué el anillo y por qué el eje vertical va fijo en 0–100 %

#### Scenario: El subtítulo no repite la bajada

- **WHEN** la card tiene una leyenda que hace falta para leer el gráfico (línea continua contra línea punteada)
- **THEN** esa leyenda sigue visible como subtítulo, y la bajada del "i" no la repite

#### Scenario: La "i" en nativo

- **WHEN** el usuario toca la "i" en la app nativa
- **THEN** el texto aparece en una tarjeta sobre un backdrop — no queda un control sin respuesta

### Requirement: El sistema SHALL comparar contra el período anterior y clasificar la señal

La pantalla SHALL mostrar la comparación con el período anterior y clasificar la señal como **mejora**, **estable** o **retroceso**, usando el veredicto de la API.

La diferencia de cumplimiento SHALL mostrarse en **puntos porcentuales** —"−6 pp"— y no como porcentaje relativo, que es un número distinto y más confuso.

#### Scenario: Pérdida de cumplimiento

- **WHEN** el cumplimiento pasó de 64 % a 58 %
- **THEN** la pantalla muestra "−6 pp" y la señal como retroceso, no "−9,4 %"

### Requirement: El cumplimiento por período se lee como tendencia y como reparto

La pantalla SHALL mostrar el cumplimiento por período en **dos piezas que comparten los mismos conteos**: un **área apilada de las cuatro bandas** con el eje Y **fijo de 0 a 100 %** —de abajo hacia arriba: cumplió, cerca, no cumplió y sin dato, con la línea de `met` arriba— y un anillo con el reparto total.

El front SHALL **NO** recalcular los umbrales de las bandas: `band_counts` por bucket y los totales por banda salen de la API, y el único cálculo permitido es repartir sobre la suma de esos conteos.

Las dos piezas SHALL compartir el denominador (`met + near + missed + unknown`), el mismo del `compliance_rate` del KPI: usar `valid_series` haría que el gráfico y el KPI se contradigan, porque las bandas solo existen para series con objetivo cargado.

Cada banda SHALL tener grosor real en la pila: "no cumplió" no SHALL quedar representado sólo por la altura de la curva de cumplimiento ni mezclado en una misma región con "sin dato".

#### Scenario: Período sin series comparables

- **WHEN** un bucket no tiene ninguna serie con objetivo cargado
- **THEN** la pila se corta en ese período en vez de caer a 0 %

#### Scenario: Período con series no cumplidas

- **WHEN** un período tiene series en la banda `missed`
- **THEN** la pila muestra esa banda con su grosor, y no solo una curva de cumplimiento más baja

#### Scenario: Reparto del anillo

- **WHEN** el usuario posa el mouse (o toca) una porción del anillo
- **THEN** el centro muestra la banda, su conteo y su porcentaje, y la leyenda sigue mostrando el conteo de las cuatro bandas sin hover

#### Scenario: Detalle de un período

- **WHEN** el usuario posa el mouse (o toca) un período de la pila
- **THEN** el tooltip lista las cuatro bandas con su porcentaje y su conteo sobre el total del período

### Requirement: La pantalla SHALL mostrar el mismo perfil a los dos roles, recortado a las series propias del corredor

El cuerpo de la pantalla —KPIs, gráficos de la paleta y panel de insights con el radar— SHALL ser **el mismo** para entrenador y corredor.

El recorte a las series propias de un corredor NO SHALL hacerse en el front: el backend ya scopea las métricas por el usuario que pregunta. Duplicar esa regla en la UI la vuelve a romper en cuanto cambie del lado del servidor, y además deja la pantalla mostrando datos ajenos si el recorte del backend falla.

El **ranking del equipo** y la comparación **entre** corredores SHALL mostrarse solo al entrenador, y no SHALL montarse para un corredor (de modo que sus requests ni se hagan). Lo decide una capacidad (`utils/dashboard-capabilities.js`), no la forma del árbol de componentes.

La comparación del **período** contra el anterior es dato propio del corredor y SHALL estar lista para mostrarse, pero SHALL permanecer apagada mientras el endpoint siga restringido a dueños del equipo (Gap 35 de `docs/BACKEND_API_GAPS.md`, interruptor `MEMBER_PERIOD_COMPARISON_ENABLED`).

Los textos que nombran el scope SHALL decir "el equipo" solo cuando el scope es el equipo: para un corredor, la pestaña del radar dice "Tu perfil" y el scope de los filtros, "Tus series". Los estados vacío y primer uso SHALL seguir la misma regla.

#### Scenario: Corredor en el equipo

- **WHEN** un miembro del equipo (no dueño) abre la pestaña Rendimiento
- **THEN** ve los mismos gráficos que el entrenador, calculados solo sobre sus series
- **AND** no ve el ranking del equipo ni la comparación entre corredores
- **AND** no sale ningún request a `/dashboard/leaderboard` ni a `/dashboard/comparisons` desde la pantalla

#### Scenario: Entrenador en el equipo

- **WHEN** el dueño del equipo abre la pestaña Rendimiento
- **THEN** además del cuerpo común ve el ranking del equipo y la comparación por período

### Requirement: El radar SHALL compartir panel con las secciones que dependen del rol

El radar SHALL compartir un panel con pestañas con el ranking del equipo y la comparación por período. La pestaña del radar SHALL ser la activa por defecto y SHALL ser la única sección montada hasta que el usuario cambie de pestaña; el ranking y la comparación SHALL montarse solo al abrir su pestaña. Para un corredor, las pestañas de ranking y comparación NO SHALL existir cuando las capacidades no las habilitan, y sus requests NO SHALL hacerse.

#### Scenario: Radar por defecto

- **WHEN** el usuario abre el panel de insights
- **THEN** ve el radar en la pestaña "Perfil en 5 ejes" y no se hizo ningún request de leaderboard ni de comparación

#### Scenario: Cambiar a ranking

- **WHEN** el entrenador abre la pestaña "Ranking"
- **THEN** se monta el ranking del equipo y el radar deja de estar montado

#### Scenario: Corredor sin pestañas ajenas

- **WHEN** un corredor abre el panel de insights
- **THEN** solo ve la pestaña del radar, sin ranking ni comparación

### Requirement: El sistema SHALL ser accesible según WCAG 2.1 AA

La pantalla SHALL cumplir WCAG 2.1 AA: navegable por teclado de punta a punta, con foco siempre visible; contraste suficiente en tema claro y oscuro; toda información expresada solo por color acompañada de texto o ícono; gráficos con descripción textual equivalente; y controles con etiqueta accesible.

La estética futurista SHALL verse sin depender del color: ningún significado se transmite solo por el color.

#### Scenario: Navegación por teclado

- **WHEN** un usuario recorre la pantalla solo con teclado
- **THEN** alcanza todos los controles en orden lógico y el foco es visible en cada uno

#### Scenario: Estado sin color

- **WHEN** se representa una señal adversa
- **THEN** aparece ícono y etiqueta de texto, no solo un tono rojo

#### Scenario: Gráfico con descrição

- **WHEN** un lector de pantalla llega a un gráfico
- **THEN** encuentra una descripción textual con el dato principal y el rango

### Requirement: El radar resume el perfil en cinco ejes normalizados

La pantalla SHALL incluir un **gráfico radar** de 5 ejes que resuma el perfil del corredor en el período:

| Eje | Se dibuja | Normalización |
|---|---|---|
| Ritmo | `totals.achieved_speed_kph` | contra `totals.target_speed_kph`, recortado a `[0, 150 %]` |
| Volumen | `totals.distance_m` | contra un **máximo fijo de 100 km por período** |
| Consistencia | `100 − (consistency.cv × 100)` | **invertido**: menos dispersión es mejor |
| Cumplimiento | `totals.compliance_rate` | directo, ya es 0–100 |
| Progresión | `50 + (trend.trend_pct × 5)` | centrado en 50, para que "sin cambio" quede en el centro |

Todos los campos se leen de la respuesta del resumen, con su contenedor real: `totals.*` y `trend.*` no están al mismo nivel.

**Un eje cuyo dato viene `null` SHALL quedar fuera del polígono**, no en cero.

Esto importa porque los `null` son el estado normal, no la excepción: `consistency.cv` es `null` con menos de 2 series, `trend.trend_pct` es `null` con menos de 3, y `totals.target_speed_kph` es `null` justamente en A reducido. En JavaScript `100 − (null × 100)` da **100**, así que sin esta regla un corredor con una sola serie vería "consistencia perfecta" y una progresión neutra sobre puntos que **no existen**: el radar comunicaría confianza con un dato que nunca se midió.

Cuando un eje queda fuera, la arista del polígono **salta ese vértice** en vez de cerrar por el centro, y el valor real se marca como no disponible en la barrita de ese eje.

**Los cinco ejes se recortan a `[0, 100]`**, sin excepción: `100 − (cv × 100)` con `cv = 1,2` daría −20, y `50 + (trend_pct × 5)` con `trend_pct = +12` daría 110. Un polígono con vértices fuera del círculo se lee como "más que máximo", que no es un valor que el eje pueda tener.

El radar SHALL aparecer **solo en la paleta A**: en la paleta B no hay con qué normalizar la mayoría de los ejes, y un radar de ceros es peor que no mostrarlo.

El eje Volumen se normaliza contra un **máximo fijo de 100 km por período**, y no contra el volumen máximo del scope: ningún endpoint expone ese máximo, y agregarlo al contrato solo para pintar un radar no vale la respuesta extra.

El radar SHALL ser **accesible por lector de pantalla**: el SVG lleva `accessibilityRole="image"` y un `accessibilityLabel` que describa los cinco valores, porque un polígono no es legible por lector de pantalla.

Cada eje SHALL mostrar su valor **real**, en las barritas que van debajo del radar. El área del radar es un resumen, no el dato: leer "volumen = 0,7" de la forma sin el número al lado inventa una precisión que el gráfico no tiene.

Los cinco valores crudos SHALL aparecer en **un solo lugar**: las barritas. El radar no repite una tabla propia con los mismos cinco números, y las barritas se acotan al ancho que ocupa el conjunto figura+polígono para que las dos piezas se lean como una sola columna.

Cada eje SHALL declarar la **escala** de su 0-100 (`hint`), porque no es comparable entre ejes: el volumen se normaliza contra 100 km fijos y la progresión está centrada en 50. El ícono de información de cada barrita la muestra.

Se elige radar y **no barras radar** porque en estas el área es proporcional al cuadrado del radio: el mismo eje se ve sistemáticamente más importante que los demás, convirtiendo una escala común en un ranking engañoso.

#### Scenario: Radar en paleta A completa

- **WHEN** el ejercicio tiene objetivo de ritmo y hay series suficientes
- **THEN** el radar muestra los cinco ejes normalizados, con su valor real en las barritas de abajo

#### Scenario: Consistencia invertida

- **WHEN** el `cv` del período es 0,08 y el de otro período es 0,02
- **THEN** el eje de consistencia del radar es **menor** en el primero, porque menos dispersión es mejor

#### Scenario: Sin radar en paleta B

- **WHEN** el ejercicio no tiene objetivo cargado
- **THEN** el radar no se renderiza, y no queda un polígono de ceros en pantalla

#### Scenario: Accesible por lector de pantalla

- **WHEN** un lector de pantalla llega al radar
- **THEN** anuncia los cinco valores por etiqueta, y los crudos quedan disponibles en las barritas de abajo

### Requirement: El sistema SHALL respetar la preferencia de movimiento reducido

Toda animación de la pantalla SHALL desactivarse cuando el usuario expresa preferencia de movimiento reducido. Las animaciones SHALL limitarse a `transform` y `opacity`, SHALL durar lo suficiente para leerse y SHALL degradarse en mobile sin perder información.

#### Scenario: Movimiento reducido activo

- **WHEN** el usuario tiene activada la preferencia de movimiento reducido
- **THEN** las transiciones aparecen de inmediato, sin desplazamiento ni escalado

### Requirement: Los filtros van en cascada y el tipo es el primero

El orden SHALL ser fijo y cada paso SHALL habilitar al siguiente:

1. **Tipo** — desplegable de selección única, con "Todos" como valor **vacío**. Es el primer filtro y el único obligatorio: sin él no se sabe qué ejercicios ofrecer.
2. **Ejercicio** — se completa con los del tipo elegido. Si el tipo está vacío, ofrece los de los tipos métricos que el catálogo del equipo tenga.
3. **Rangos de distancia y tiempo** — escribibles a mano y con valores sugeridos. Se habilitan con el **scope** (grupo o corredor), no con el ejercicio: acotan las series del scope y el backend aplica los cuatro parámetros por su cuenta. Depender del ejercicio los apagaba cada vez que la cascada lo deseleccionaba al cambiar de grupo o corredor, y el bloqueo se veía intermitente.
4. **Fechas** — siempre disponibles.

Cambiar el tipo SHALL **deseleccionar el ejercicio** si deja de estar en la nueva lista. Dejarlo puesto produce un estado imposible visible: un filtro que dice "velocidad en distancia" con un ejercicio de ritmo continuo elegido arriba.

El filtro de tipo viaja al backend como `kind` **escalar**, no como el array `kinds[]` que había antes: la UI es de selección única, y el "todos" es la **ausencia** del parámetro.

El desplegable de tipo SHALL ofrecer **solo los tipos con al menos un ejercicio** en el catálogo del equipo. El backend responde `404` a un `kind` que no resuelve a ningún ejercicio del owner (`catalogExercisesInScope`), así que ofrecer un tipo vacío termina en "recurso inexistente" al aplicar, no en un dashboard sin datos.

#### Scenario: Elegir un tipo completa el ejercicio

- **WHEN** el usuario elige `ritmo_continuo`
- **THEN** el selector de ejercicio ofrece solo los `ritmo_continuo` del grupo

#### Scenario: "Todos" ofrece los tipos disponibles

- **WHEN** el usuario deja el tipo vacío
- **THEN** el selector de ejercicio ofrece los ejercicios de todos los tipos métricos que el catálogo del equipo tenga

#### Scenario: Un tipo sin ejercicios no se ofrece

- **WHEN** el catálogo del equipo no tiene ningún ejercicio de `velocidad_tiempo`
- **THEN** ese tipo no aparece en el desplegable, en vez de ofrecer una opción que termina en `404` al aplicarla

#### Scenario: Cambiar de tipo limpia el ejercicio

- **WHEN** hay "Pasadas 1000 m" elegido y el usuario cambia a `ritmo_continuo`
- **THEN** el ejercicio se deselcciona, porque no pertenece al tipo nuevo

#### Scenario: El rango no espera a un ejercicio

- **WHEN** no hay ningún ejercicio elegido pero sí un grupo o corredor en el scope
- **THEN** los cuatro campos de rango están habilitados

### Requirement: Los rangos de distancia y tiempo son escribibles y sugieren valores

Cada rango tiene un campo numérico que acepta **texto libre** y un desplegable con valores frecuentes:

- **Distancia (km):** 1, 2, 3, 5, 7, 10, 15, 21, 42
- **Tiempo (min):** 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360

El usuario puede escribir un valor que no esté en la lista. La lista es un atajo, no un `select` cerrado: si fuera estricto, quien corrió 3,5 km no podría filtrar por eso.

El campo SHALL mostrar la **unidad** y convertir al serializar el request: km → metros (`× 1000`), minutos → minutos. La conversión ocurre **en el borde**, nunca en el valor que se muestra.

Un valor escrito a mano fuera de la lista SHALL quedar seleccionado igual, para que la pantalla muestre qué se está filtrando en vez de un input aparentemente vacío.

Un rango invertido (desde mayor que hasta) SHALL mostrar el error **antes** de mandar, sin esperar el `400` del backend.

El form SHALL ser un **borrador**: escribir o elegir un filtro NO SHALL disparar ninguna consulta. Las métricas SHALL recalcularse recién al presionar "Filtrar", nunca por tecla. Mientras el borrador tenga un rango inválido, "Filtrar" SHALL estar deshabilitado — no se manda un filtro a medias.

Cada rango SHALL presentarse como **un solo grupo** —título "Distancia" (o "Tiempo") con los dos extremos debajo, lado a lado— para que los cuatro campos formen una grilla de 2×2 y no cuatro filas de ancho completo. El título NO SHALL repetir "desde / hasta": cada extremo ya lo dice en su propio rótulo visible ("Desde"/"Hasta"). El nombre accesible de cada extremo SHALL seguir siendo el completo ("Distancia desde"): hay dos "Desde" y dos "Hasta" en la misma pantalla y sin eso el lector de pantalla los confunde.

#### Scenario: Escribir un valor fuera de la lista

- **WHEN** el usuario escribe 3,5 en "Distancia desde" y presiona "Filtrar"
- **THEN** el campo muestra `3,5 km` y el request manda `distance_from_m=3500`

#### Scenario: Elegir de la lista

- **WHEN** el usuario elige 21 en "Distancia hasta" y presiona "Filtrar"
- **THEN** el request manda `distance_to_m=21000`

#### Scenario: El rango invertido se avisa antes de mandar

- **WHEN** el usuario pone 42 en "desde" y 5 en "hasta"
- **THEN** el campo muestra el error sin necesidad de esperar la respuesta

#### Scenario: Los dos rangos comparten una grilla

- **WHEN** se abre la barra de filtros en ventana ancha
- **THEN** los títulos de Distancia y de Tiempo quedan en la misma fila, cada uno con sus dos cajas de extremo debajo

### Requirement: Las fechas van en un solo grupo y las acciones viven al pie del form

Las dos fechas SHALL presentarse como **un solo grupo** —título "Fecha" con los dos extremos debajo, lado a lado— y no como dos campos con título propio, para que el form tenga una sola forma de mostrar un rango (fechas, distancia y tiempo). El título NO SHALL repetir "desde / hasta": cada extremo ya lo dice en su propio rótulo visible. El nombre accesible de cada extremo SHALL seguir siendo el completo ("Fecha desde").

Los botones "Filtrar" y "Limpiar" SHALL vivir **al pie del form**, debajo del grupo de fechas y alineados a la derecha, y no en el header del panel colapsado: ahí quedaba arriba de todo, lejos de lo que limpia, y duplicaba el badge, que ya dice cuántos filtros hay. "Filtrar" SHALL ser la acción primaria (verde) y estar siempre visible, porque es la única forma de aplicar el borrador; "Limpiar" SHALL ser secundaria (gris) y mostrarse solo cuando hay filtros aplicados. "Limpiar" SHALL limpiar el borrador y aplicar el estado vacío en el mismo click.

En viewport ancha el form abierto SHALL ocupar **dos filas** sin esconder ningún filtro: Grupo, Corredor, Tipo y Ejercicio comparten la primera fila, y Distancia, Tiempo y Fecha+acciones la segunda. Las acciones van debajo de la fecha, dentro de su misma columna. En viewport angosta los grupos SHALL apilarse. La línea de ayuda de los rangos NO SHALL ocupar una fila propia; el estado de carga SHALL comunicarse en el placeholder de los campos.

#### Scenario: Las acciones cierran el form debajo de la fecha

- **WHEN** se abre la barra de filtros en ventana ancha con al menos un filtro aplicado
- **THEN** el grupo "Fecha" y los botones "Limpiar" (gris, con ícono de escoba) y "Filtrar" (verde, con ícono de embudo con tilde) comparten la tercera columna de la segunda fila, con las acciones debajo de las fechas y "Limpiar" fuera del header del panel

#### Scenario: El form ocupa dos filas en ancho

- **WHEN** se abre la barra de filtros en ventana ancha
- **THEN** Grupo, Corredor, Tipo y Ejercicio comparten la primera fila, y Distancia, Tiempo y Fecha+acciones la segunda, con todos los filtros visibles y sin una fila extra de ayuda

#### Scenario: Sin filtros puestos

- **WHEN** no hay ningún filtro aplicado
- **THEN** "Limpiar" no se muestra (no hay nada que limpiar) y "Filtrar" sigue visible

#### Scenario: Escribir no consulta

- **WHEN** el usuario modifica cualquier filtro del form sin presionar "Filtrar"
- **THEN** no se dispara ninguna consulta de métricas y la pantalla sigue mostrando el resultado del último estado aplicado

#### Scenario: Aplicar el borrador

- **WHEN** el usuario presiona "Filtrar"
- **THEN** las cinco consultas de métricas salen con los valores del borrador como nuevo scope

#### Scenario: Cambiar el corredor se aplica con "Filtrar"

- **WHEN** el entrenador elige otro corredor en el select "Corredor" y presiona "Filtrar"
- **THEN** las cuatro consultas de métricas y el detalle de series mandan `athlete_user_id` y muestran solo las series de ese corredor

### Requirement: Aplicar filtros muestra una espera

Mientras las métricas del scope recién aplicado están en vuelo, la pantalla SHALL mostrar la animación de espera del corredor (el mismo asset GIF de la app) con el texto "Cargando métricas…", en una capa que bloquee los filtros. La capa SHALL aparecer solo cuando hay un fetch real disparado por "Filtrar"/"Limpiar" (no durante el sondeo de 90 s) y SHALL permanecer visible un mínimo de 450 ms, para que el cambio se registre aunque la respuesta llegue al instante. La carga inicial sigue usando el skeleton, no esta capa.

#### Scenario: Aplicar un filtro con datos en camino

- **WHEN** el usuario presiona "Filtrar" y las métricas tardan en responder
- **THEN** se muestra la animación con "Cargando métricas…" hasta que llegan las respuestas del nuevo scope

#### Scenario: El sondeo no muestra la capa

- **WHEN** el sondeo de 90 s refresca las métricas sin que el usuario haya aplicado un filtro
- **THEN** la capa de espera no aparece y los datos se actualizan en su lugar

#### Scenario: Aplicar sin cambios

- **WHEN** el usuario presiona "Filtrar" sin haber modificado el borrador
- **THEN** no se dispara ninguna request y la capa de espera no aparece

### Requirement: La pantalla SHALL adaptarse a mobile sin perder la información principal

En viewport angosto la pantalla SHALL apilarse en el orden: KPIs → gráfico principal → leaderboard colapsado. Los filtros SHALL vivir en una hoja inferior y los KPIs SHALL permanecer legibles sin scroll horizontal. Ninguna información SHALL existir solo en la versión de escritorio.

#### Scenario: Mobile sin scroll horizontal

- **WHEN** se abre la pantalla en un viewport angosto
- **THEN** el contenido no desborda horizontalmente y los KPIs son legibles sin zoom

#### Scenario: Orden de prioridad en mobile

- **WHEN** se recorre la pantalla en mobile
- **THEN** los KPIs aparecen antes que los gráficos, y el leaderboard aparece colapsado al final

### Requirement: El sistema SHALL exportar los datos a CSV y PDF

La pantalla SHALL permitir exportar a **CSV** y a **PDF** los datos que ya tiene en memoria.

El CSV SHALL generarse en el cliente a partir de la respuesta de la API, con una fila por serie y columnas tipadas. El PDF SHALL generarse con el stack ya presente en la app: `expo-print` y `expo-sharing` en nativo, y una ventana de impresión sobre el documento en web.

En web el PDF SHALL abrir el diálogo de impresión del navegador: la ruta de impresión nativa **no** funciona en web porque su implementación imprime la página de la aplicación en lugar del documento.

#### Scenario: Exportar CSV

- **WHEN** el usuario exporta con datos cargados
- **THEN** se descarga un CSV con una fila por serie, encabezados en español y las unidades en el nombre de la columna

#### Scenario: Exportar PDF en nativo

- **WHEN** el usuario exporta a PDF en mobile
- **THEN** se genera el documento con `expo-print` y se ofrece compartirlo

#### Scenario: Exportar PDF en web

- **WHEN** el usuario exporta a PDF en web
- **THEN** se abre el diálogo de impresión del navegador con el documento del dashboard, no la aplicación completa

#### Scenario: El CSV se arma con las series ya cargadas

- **WHEN** el usuario presiona "Exportar CSV"
- **THEN** el archivo se genera con las series que la pantalla ya precargó al elegir el ejercicio, sin pedir nada al backend en ese momento — en web una descarga disparada después de un `await` puede quedar bloqueada por el navegador

#### Scenario: Sin ejercicio elegido

- **WHEN** el usuario presiona "Exportar CSV" sin haber elegido un ejercicio del catálogo
- **THEN** se le avisa que el detalle por serie se exporta de un ejercicio, y no se descarga un archivo con solo el encabezado. El PDF sigue disponible: es el resumen del período, no depende de un ejercicio

### Requirement: El sistema SHALL mantener el dashboard al día sin WebSocket

La pantalla SHALL refrescar los datos por sondeo periódico, con un intervalo de entre 60 y 120 segundos, y SHALL refrescar de inmediato al **aplicar** los filtros (botón "Filtrar" o "Limpiar"), no al editarlos.

La actualización SHALL NOT los datos ya mostrados mientras llegan los nuevos: un parpadeo a skeleton en cada sondeo haría la pantalla inutilizable.

#### Scenario: Sondeo con datos visibles

- **WHEN** llega un ciclo de sondeo con la pantalla mostrando datos
- **THEN** los datos se actualizan sin volver al estado de carga

#### Scenario: Cambio de filtro

- **WHEN** el usuario cambia el grupo o el tipo de ejercicio
- **THEN** la pantalla consulta inmediatamente, sin esperar el próximo ciclo

### Requirement: El sistema SHALL admitir navegación por teclado en los tabs de filtro

Los filtros de tipo de ejercicio SHALL comportarse como un `tablist`: navegación con flechas entre opciones, `Home`/`End` para ir a la primera y la última, y devolviendo el foco a la opción movida.

La opción activa SHALL estar marcada con `aria-selected`, y la que no, con `tabIndex` negativo, de modo que el recorrido con `Tab` entre en el grupo una sola vez.

#### Scenario: Flechas entre tipos de ejercicio

- **WHEN** el foco está en un filtro de tipo y el usuario pulsa la flecha derecha
- **THEN** la selección avanza a la siguiente opción y el foco queda en ella

#### Scenario: El filtro no se recorre de a uno en uno con Tab

- **WHEN** el usuario navega con `Tab` hasta el grupo de filtros
- **THEN** el foco entra una vez al grupo, y desde ahí se mueve con flechas

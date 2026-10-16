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

Hacen falta los tres porque `has_target` solo no alcanza. Con `axis: "distance"` —un `velocidad_distancia` de 100 m, que son 4 de los 12 ejercicios del seed— hay objetivo **y** `has_target: true`, pero **no hay tiempo objetivo**, así que `target_speed_kph` viene `null`: la velocidad esperada es imposible de derivar de la distancia sola. Mostrar un gauge "ritmo vs objetivo" ahí sería inventar un objetivo que no existe.

| Caso | Condición | Número principal | Piezas de objetivo |
|---|---|---|---|
| **A completo** | `has_target` y `target_speed_kph != null` | **ritmo** (km/h), salvo `liviano`, que muestra **volumen** | gauge de ritmo, delta, cumplimiento, consistencia, evolución |
| **A reducido** | `has_target` y `target_speed_kph == null` (eje `distance`) | **distancia** (m) | cumplimiento por distancia, delta, evolución. **Sin** gauge de ritmo ni velocidad esperada |
| **B** | `has_target == false` | **mejor tiempo** (s) | ninguna: sin objetivo no hay contra qué comparar |

Los tres tipos con métrica son `ritmo_continuo`, `velocidad_distancia` y `velocidad_tiempo`. `liviano` y `elongacion` **no se ofrecen como filtro**: sus series son `warmup`/`cooldown` y nunca pasarían el filtro `role = 'main'` del backend.

`liviano` es la excepción al número principal: el tipo se define por **volumen, no por ritmo** (`utils/exercise-field-matrix.js:24-31`, `showSpeed: false`, sin ícono de velocidad). Mostrar 7,2 km/h como número principal de un calentamiento de 10 minutos sería medirlo con una vara que el producto no usa para ese tipo. Para `liviano`, el número principal es el **volumen** (distancia o tiempo, el que esté cargado) y las piezas de ritmo no se pintan.

Aplica a **4 de los 12 ejercicios del seed** (Pasadas 1000/2000 m y Velocidad Máxima 100/200 m) el caso A reducido. Ninguno de los 12 llega a la paleta B, así que esa se cubre por robustez —filas previas a la migración de tipos, o un ejercicio que el entrenador dejó incompleto— y no por el seed.

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

### Requirement: El sistema SHALL exponer el estado de calidad de los datos

La pantalla SHALL mostrar el bloque `data_quality` que devuelve la API, con sus **seis** campos: series no calculables, tiempo degradado, estado de cumplimiento desconocido, sesiones sin cerrar, sesiones sin registro y volumen insuficiente.

`legacy_sessions` SHALL mostrarse como **nota al pie informativa**, nunca como advertencia, junto a un texto que aclare que esas series se incluyen igual en los KPI. Es el único contador del bloque que no es un defecto: sin esa aclaración, el usuario lo lee como "algo está mal" y busca un error que no existe.

Cuando `insufficient_data` sea verdadero, la pantalla SHALL ocultar los indicadores de tendencia y mostrar el motivo, en lugar de mostrar un porcentaje calculado sobre muy pocos datos.

#### Scenario: Tendencia sin volumen suficiente

- **WHEN** la API devuelve `insufficient_data: true` y `trend_pct: null`
- **THEN** la pantalla no muestra flecha de tendencia ni porcentaje, y explica que hay datos insuficientes

### Requirement: El sistema SHALL indicar la fuente de cada número

Todo KPI SHALL mostrar la unidad en la que está expresado —km/h, min, m, s— y SHALL ofrecer un tooltip con el detalle de cómo se calculó ese número, incluyendo la tolerancia aplicada y la cantidad de series usadas.

Las unidades SHALL venir del bloque `units` de la respuesta, y **solo de claves que el backend declare**: `speed` (km/h), `time` (ms), `distance` (m), `delta` (%), `compliance` (%), `best_time` (ms) y `percentage_point` (pp).

Los valores crudos llegan en **milisegundos** —`best_time_ms`, `time_ms`— y el front SHALL formatearlos a `m:ss` o `h:mm:ss` para mostrarlos. Esa conversión es **de formato, no de cálculo**: no cambia el valor, solo lo escribe. No existe clave `s` ni `min` en el contrato, y el front no puede inventar una ni convertir unidades por su cuenta.

`compliance_rate` llega en 0–100 y `compliance_pp` en puntos porcentuales: el front SHALL **no** multiplicar por 100 para mostrarlo.


#### Scenario: Tooltip de un KPI

- **WHEN** el usuario consulta el tooltip del ritmo promedio
- **THEN** ve la fórmula, la tolerancia efectivamente aplicada (`tolerance_applied`) y cuántas series entraron (`series_count`)

### Requirement: El sistema SHALL comparar contra el período anterior y clasificar la señal

La pantalla SHALL mostrar la comparación con el período anterior y clasificar la señal como **mejora**, **estable** o **retroceso**, usando el veredicto de la API.

La diferencia de cumplimiento SHALL mostrarse en **puntos porcentuales** —"−6 pp"— y no como porcentaje relativo, que es un número distinto y más confuso.

#### Scenario: Pérdida de cumplimiento

- **WHEN** el cumplimiento pasó de 64 % a 58 %
- **THEN** la pantalla muestra "−6 pp" y la señal como retroceso, no "−9,4 %"

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

Cuando un eje queda fuera, la arista del polígono **salta ese vértice** en vez de cerrar por el centro, y el valor real se marca como no disponible en la tabla de debajo.

**Los cinco ejes se recortan a `[0, 100]`**, sin excepción: `100 − (cv × 100)` con `cv = 1,2` daría −20, y `50 + (trend_pct × 5)` con `trend_pct = +12` daría 110. Un polígono con vértices fuera del círculo se lee como "más que máximo", que no es un valor que el eje pueda tener.

El radar SHALL aparecer **solo en la paleta A**: en la paleta B no hay con qué normalizar la mayoría de los ejes, y un radar de ceros es peor que no mostrarlo.

El eje Volumen se normaliza contra un **máximo fijo de 100 km por período**, y no contra el volumen máximo del scope: ningún endpoint expone ese máximo, y agregarlo al contrato solo para pintar un radar no vale la respuesta extra.

El radar SHALL ser **accesible en tabla**: el SVG lleva `accessibilityRole="image"` y un `accessibilityLabel` que describa los cinco valores, porque un polígono no es legible por lector de pantalla, y debajo va una tabla con los valores crudos.

Cada eje SHALL mostrar su valor **real** junto al polígono. El área del radar es un resumen, no el dato: leer "volumen = 0,7" de la forma sin el número al lado inventa una precisión que el gráfico no tiene.

Se elige radar y **no barras radar** porque en estas el área es proporcional al cuadrado del radio: el mismo eje se ve sistemáticamente más importante que los demás, convirtiendo una escala común en un ranking engañoso.

#### Scenario: Radar en paleta A completa

- **WHEN** el ejercicio tiene objetivo de ritmo y hay series suficientes
- **THEN** el radar muestra los cinco ejes normalizados, con su valor real al lado

#### Scenario: Consistencia invertida

- **WHEN** el `cv` del período es 0,08 y el de otro período es 0,02
- **THEN** el eje de consistencia del radar es **menor** en el primero, porque menos dispersión es mejor

#### Scenario: Sin radar en paleta B

- **WHEN** el ejercicio no tiene objetivo cargado
- **THEN** el radar no se renderiza, y no queda un polígono de ceros en pantalla

#### Scenario: Accesible por lector de pantalla

- **WHEN** un lector de pantalla llega al radar
- **THEN** anuncia los cinco valores por etiqueta, y la tabla de valores crudos queda disponible debajo

### Requirement: El sistema SHALL respetar la preferencia de movimiento reducido

Toda animación de la pantalla SHALL desactivarse cuando el usuario expresa preferencia de movimiento reducido. Las animaciones SHALL limitarse a `transform` y `opacity`, SHALL durar lo suficiente para leerse y SHALL degradarse en mobile sin perder información.

#### Scenario: Movimiento reducido activo

- **WHEN** el usuario tiene activada la preferencia de movimiento reducido
- **THEN** las transiciones aparecen de inmediato, sin desplazamiento ni escalado

### Requirement: Los filtros van en cascada y el tipo es el primero

El orden SHALL ser fijo y cada paso SHALL habilitar al siguiente:

1. **Tipo** — desplegable de selección única, con "Todos" como valor **vacío**. Es el primer filtro y el único obligatorio: sin él no se sabe qué ejercicios ofrecer.
2. **Ejercicio** — se completa con los del tipo elegido. Si el tipo está vacío, ofrece los de los tres tipos métricos.
3. **Rangos de distancia y tiempo** — escribibles a mano y con valores sugeridos. Se habilitan cuando hay un ejercicio elegido, porque sin ejercicio el rango no tiene contra qué acotar.
4. **Fechas** — siempre disponibles.

Cambiar el tipo SHALL **deseleccionar el ejercicio** si deja de estar en la nueva lista. Dejarlo puesto produce un estado imposible visible: un filtro que dice "velocidad en distancia" con un ejercicio de ritmo continuo elegido arriba.

El filtro de tipo viaja al backend como `kind` **escalar**, no como el array `kinds[]` que había antes: la UI es de selección única, y el "todos" es la **ausencia** del parámetro.

#### Scenario: Elegir un tipo completa el ejercicio

- **WHEN** el usuario elige `ritmo_continuo`
- **THEN** el selector de ejercicio ofrece solo los `ritmo_continuo` del grupo

#### Scenario: "Todos" ofrece los tres tipos

- **WHEN** el usuario deja el tipo vacío
- **THEN** el selector de ejercicio ofrece los ejercicios de los tres tipos métricos

#### Scenario: Cambiar de tipo limpia el ejercicio

- **WHEN** hay "Pasadas 1000 m" elegido y el usuario cambia a `ritmo_continuo`
- **THEN** el ejercicio se deselcciona, porque no pertenece al tipo nuevo

#### Scenario: El rango espera a un ejercicio

- **WHEN** no hay ningún ejercicio elegido
- **THEN** los cuatro campos de rango están deshabilitados

### Requirement: Los rangos de distancia y tiempo son escribibles y sugieren valores

Cada rango tiene un campo numérico que acepta **texto libre** y un desplegable con valores frecuentes:

- **Distancia (km):** 1, 2, 3, 5, 7, 10, 15, 21, 42
- **Tiempo (min):** 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360

El usuario puede escribir un valor que no esté en la lista. La lista es un atajo, no un `select` cerrado: si fuera estricto, quien corrió 3,5 km no podría filtrar por eso.

El campo SHALL mostrar la **unidad** y convertir al serializar el request: km → metros (`× 1000`), minutos → minutos. La conversión ocurre **en el borde**, nunca en el valor que se muestra.

Un valor escrito a mano fuera de la lista SHALL quedar seleccionado igual, para que la pantalla muestre qué se está filtrando en vez de un input aparentemente vacío.

Un rango invertido (desde mayor que hasta) SHALL mostrar el error **antes** de mandar, sin esperar el `400` del backend.

#### Scenario: Escribir un valor fuera de la lista

- **WHEN** el usuario escribe 3,5 en "Distancia desde"
- **THEN** el campo muestra `3,5 km` y el request manda `distance_from_m=3500`

#### Scenario: Elegir de la lista

- **WHEN** el usuario elige 21 en "Distancia hasta"
- **THEN** el request manda `distance_to_m=21000`

#### Scenario: El rango invertido se avisa antes de mandar

- **WHEN** el usuario pone 42 en "desde" y 5 en "hasta"
- **THEN** el campo muestra el error sin necesidad de esperar la respuesta

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

### Requirement: El sistema SHALL mantener el dashboard al día sin WebSocket

La pantalla SHALL refrescar los datos por sondeo periódico, con un intervalo de entre 60 y 120 segundos, y SHALL refrescar de inmediato al cambiar los filtros.

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

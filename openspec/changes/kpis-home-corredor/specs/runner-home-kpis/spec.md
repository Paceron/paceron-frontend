# Spec Delta

## Purpose

Tarjeta de KPIs del Home del corredor: muestra, al final del Home, los números
del período calendario elegido en cuatro pestañas que se cargan bajo demanda. El
frontend consume el endpoint `GET /api/v1/dashboard/runner-kpis` del change
homónimo de `paceron-backend` y no recalcula ninguna métrica.

## ADDED Requirements

### Requirement: La tarjeta SHALL agregarse al final del Home del corredor

La pantalla `AuthenticatedHomeScreen` SHALL montar una tarjeta nueva **después**
de `AchievementHighlightCard` y dentro del bloque que ya se muestra para
`activeRole === 'runner'`.

La tarjeta NO SHALL reemplazar, reordenar, ocultar ni modificar el comportamiento
de `NextTrainingBanner`, `StreakBanner` ni `AchievementHighlightCard`.

La tarjeta NO SHALL mostrarse para un usuario cuyo rol activo no sea `runner`.

#### Scenario: Orden del Home

- **WHEN** un corredor abre el Home
- **THEN** ve la próxima sesión, la racha, el logro más cercano y, al final, la tarjeta de KPIs, en ese orden

#### Scenario: Entrenador

- **WHEN** un usuario con rol activo `trainer` abre el Home
- **THEN** la tarjeta de KPIs no se monta y no se hace ninguna request de KPIs

#### Scenario: Sin logro destacado

- **WHEN** `AchievementHighlightCard` no se renderiza porque no hay logros
- **THEN** la tarjeta de KPIs igual aparece al final, sin dejar un hueco

### Requirement: El título SHALL incluir el período y los días considerados

La tarjeta SHALL tener un título con dos partes: el nombre del período y la
cantidad de días considerados. El selector `Mes`, `Semana`, `Día` SHALL estar en
la misma cabecera y SHALL ser el único control para cambiar el tipo de período.

El valor inicial SHALL ser `Mes` y la fecha de referencia SHALL ser la fecha
local del dispositivo. El frontend SHALL enviar esa fecha como
`reference_date=YYYY-MM-DD`.

El texto SHALL construirse con `from`, `to` y `days_considered` de la respuesta,
no con un cálculo local de días:

- **Mes:** `Octubre 2026 · 31 días considerados`
- **Semana:** `26/10/2026 al 01/11/2026 · 7 días considerados`
- **Día:** `28/10/2026 · 1 día considerado`

El singular SHALL usarse cuando `days_considered === 1`.

No SHALL haber navegación a meses, semanas o días anteriores: el selector
cambia el tipo de período del período actual. Una navegación de fechas sería
otro alcance y este pedido no la incluye.

#### Scenario: Default mes

- **WHEN** un corredor abre el Home por primera vez
- **THEN** el selector está en `Mes`, el título muestra el mes calendario actual y `days_considered` del backend

#### Scenario: Cambio a semana

- **WHEN** el corredor toca `Semana`
- **THEN** el título muestra el lunes y el domingo de la semana actual y `7 días considerados`

#### Scenario: Cambio a día

- **WHEN** el corredor toca `Día`
- **THEN** el título muestra la fecha actual y `1 día considerado`

#### Scenario: Febrero

- **WHEN** el backend devuelve `days_considered=29` para febrero de 2028
- **THEN** el título dice `29 días considerados`, sin recalcular el mes en el front

### Requirement: El encabezado SHALL explicar el alcance y linkear a equipos

Junto al kicker `Tus números` SHALL haber un botón de información cuyo tooltip
SHALL explicar que la tarjeta es un resumen y SHALL ofrecer el link a la
pestaña de rendimiento de los equipos.

El texto SHALL ser: `Resumen de tu rendimiento. Para más detalle, mirá la
pestaña de rendimiento de tus equipos.` La frase `pestaña de rendimiento de tus
equipos` SHALL ser un link a `/teams`.

El tooltip SHALL abrirse por click/tap y NO SHALL abrirse solo por hover: al
tener un link interactivo, cerrarse al mover el mouse hacia el link lo haría
inusable. En web, el foco SHALL poder pasar del trigger al link sin que el
tooltip se cierre.

#### Scenario: Abrir la ayuda del encabezado

- **WHEN** el corredor toca o hace click en el ícono de información de `Tus números`
- **THEN** se abre el tooltip con el texto de resumen y el link a la pestaña de rendimiento

#### Scenario: Ir a equipos desde la ayuda

- **WHEN** el corredor activa el link `pestaña de rendimiento de tus equipos`
- **THEN** la app navega a `/teams`

#### Scenario: Foco de teclado en el tooltip

- **WHEN** el corredor enfoca el trigger con Tab y vuelve a presionar Tab
- **THEN** el foco pasa al link sin que el tooltip se cierre

### Requirement: Las pestañas SHALL cargarse bajo demanda

La tarjeta SHALL tener cuatro pestañas:

| Orden | Label | `tab` |
|---|---|---|
| 1 | Números generales | `general` |
| 2 | Ritmo continuo | `ritmo_continuo` |
| 3 | Velocidad en tiempo | `velocidad_tiempo` |
| 4 | Velocidad en distancia | `velocidad_distancia` |

La pestaña inicial SHALL ser `general` y SHALL disparar una request al montar la
tarjeta. Cambiar a otra pestaña SHALL disparar una request con ese `tab`; las
otras tres NO SHALL pedirse al montar.

Cada vez que se selecciona una pestaña se SHALL ejecutar su consulta, incluso si
ya estuvo seleccionada antes. Si hay datos cacheados, se SHALL mostrar el último
valor conocido y revalidar en segundo plano; si no hay datos para esa pestaña y
período, se SHALL mostrar el estado de carga.

La pestaña `Velocidad en distancia` consume `tab=velocidad_distancia`: es el
único tipo métrico restante además de `ritmo_continuo` y `velocidad_tiempo`, y
permite calcular las tres métricas de la pestaña. El label acompaña al `kind`
para que el corredor no lea dos pestañas con el mismo nombre.

#### Scenario: Apertura

- **WHEN** se monta la tarjeta
- **THEN** se hace una sola request, con `tab=general`

#### Scenario: Primera selección de ritmo

- **WHEN** el corredor toca `Ritmo continuo`
- **THEN** se hace una request con `tab=ritmo_continuo` y se muestra el loading si no había datos cacheados

#### Scenario: Volver a una pestaña ya vista

- **WHEN** el corredor vuelve a `Números generales` después de haberla visto
- **THEN** se muestran los datos cacheados y se revalida sin bloquear la tarjeta

#### Scenario: Cambio de período

- **WHEN** el corredor cambia de `Mes` a `Día` estando en `Velocidad en tiempo`
- **THEN** se pide `period=day&tab=velocidad_tiempo` y se mantiene la pestaña activa

### Requirement: Cada pestaña SHALL mostrar una grilla de cards de métricas

La tarjeta SHALL mostrar una grilla de cards, una por métrica, con nombre, ícono
y valor. Cada card SHALL reutilizar `KpiTile` y su tooltip SHALL reutilizar
`KpiTooltip`, ambos del dashboard, para mantener las mismas fuentes, el mismo
tamaño y la misma interacción. Las métricas SHALL ser:

**Números generales (`general`)**

| Label | Campo |
|---|---|
| Distancia recorrida | `metrics.total_distance_m` |
| Mayor distancia en un día | `metrics.best_day_distance_m` |
| Mejor velocidad | `metrics.best_speed_kph` |
| Velocidad promedio | `metrics.average_speed_kph` |

**Ritmo continuo (`ritmo_continuo`)**

| Label | Campo |
|---|---|
| Distancia recorrida | `metrics.total_distance_m` |
| Velocidad promedio | `metrics.average_speed_kph` |
| Mejor velocidad | `metrics.best_speed_kph` |
| Mayor distancia en un ejercicio | `metrics.best_distance_m` |

**Velocidad en tiempo (`velocidad_tiempo`)**

| Label | Campo |
|---|---|
| Distancia recorrida | `metrics.total_distance_m` |
| Velocidad promedio | `metrics.average_speed_kph` |
| Mejor tiempo | `metrics.best_time_ms` |

**Velocidad en distancia (`velocidad_distancia`)**

| Label | Campo |
|---|---|
| Distancia recorrida | `metrics.total_distance_m` |
| Velocidad promedio | `metrics.average_speed_kph` |
| Mejor velocidad | `metrics.best_speed_kph` |

La fecha del mejor día NO SHALL ser una card propia: SHALL mostrarse como línea
del tooltip de `Mayor distancia en un día`, formateada como `DD/MM/YYYY`. Si
`best_day_date` es `null`, esa línea SHALL omitirse.

En `Números generales`, el valor de `metrics.average_speed_kph` SHALL mostrarse
bajo el label corto `Velocidad promedio`: el backend define ese campo en esa
pestaña solo con las series de `ritmo_continuo`. El alcance SHALL explicarse en
el tooltip de la card. El frontend NO SHALL recalcularlo ni sustituirlo por un
promedio de todos los tipos.

Cada card SHALL tener un tooltip que explique la fórmula de su métrica. El
tooltip SHALL abrirse por hover y foco de teclado en web y por tap en touch, y
SHALL mostrar `Series usadas: <valid_series>` y `Sesiones: <sessions>` cuando la
respuesta tenga datos. El tooltip de `Mayor distancia en un día` SHALL agregar
`Fecha del mejor día: <DD/MM/YYYY>` antes de esos contadores. NO SHALL mostrar
la tolerancia del dashboard, que no aplica a estas métricas. El tooltip NO SHALL
quedar recortado por la tarjeta ni por la card vecina.

En desktop, la grilla SHALL adaptar las columnas a la cantidad de cards de la
pestaña: 4 cards SHALL ir 2×2, 3 cards SHALL ir en una sola línea y 5 o 6 cards
SHALL ir 3 arriba y 2 o 3 abajo. En mobile SHALL usar siempre dos columnas para
que los valores formateados no se corten. La grilla NO SHALL generar scroll
horizontal.

El frontend NO SHALL sumar, promediar, agrupar ni derivar ninguna de estas
métricas. Solo SHALL leer el campo y formatearlo.

#### Scenario: Números generales

- **WHEN** la API devuelve `total_distance_m=84250`, `best_day_distance_m=12000`, `best_day_date="2026-10-11"` y `best_speed_kph=16.4`
- **THEN** las cards muestran `84,3 km`, `12,0 km` y `16,4 km/h`, y el tooltip de la mayor distancia muestra `Fecha del mejor día: 11/10/2026`

#### Scenario: Fecha del mejor día sin dato

- **WHEN** `best_day_date` viene `null`
- **THEN** no aparece la línea de fecha en el tooltip y la card sigue mostrando la mayor distancia

#### Scenario: Promedio general de ritmo continuo

- **WHEN** `general` devuelve `average_speed_kph=10.8`
- **THEN** la card `Velocidad promedio` muestra `10,8 km/h` sin recalcular el promedio, y su tooltip aclara que solo usa series de ritmo continuo

#### Scenario: Pestaña de velocidad en tiempo

- **WHEN** la API devuelve `best_time_ms=1380000`
- **THEN** la card de tiempo muestra `23:00`, no `1380000 ms`

#### Scenario: Tooltip de una card

- **WHEN** el corredor apoya el cursor, enfoca con Tab o toca una card
- **THEN** se abre su tooltip con la fórmula, `Series usadas` y `Sesiones`

#### Scenario: Sin dato

- **WHEN** un campo viene `null`
- **THEN** la card muestra `—` y no `0`, `NaN` ni una unidad suelta

#### Scenario: Cero real

- **WHEN** `total_distance_m` viene `0` con `has_data=true`
- **THEN** la card muestra `0 m`, porque el cero es un resultado real

### Requirement: El formato SHALL ser legible para una persona

El helper de formato SHALL usar locale `es-AR` y estas reglas:

| Magnitud | Regla | Ejemplo |
|---|---|---|
| Distancia | menos de 1000 m en metros enteros; desde 1000 m en km con un decimal | `850 m`, `12,4 km` |
| Velocidad | km/h con un decimal | `10,8 km/h` |
| Tiempo | reloj: `m:ss` o `h:mm:ss` según duración | `23:00`, `1:05:30` |
| Fecha | `DD/MM/YYYY` | `11/10/2026` |
| Ausencia | `—` | `—` |

El formato SHALL vivir en una función pura, testeable, y NO SHALL repetirse en
cada card del JSX. La unidad de distancia del contrato es metros; la conversión
a km es solo de presentación.

#### Scenario: Distancia corta

- **WHEN** el valor es `850`
- **THEN** se muestra `850 m`

#### Scenario: Distancia larga

- **WHEN** el valor es `12400`
- **THEN** se muestra `12,4 km`

#### Scenario: Negativo no esperado

- **WHEN** un valor de distancia o velocidad llega negativo por un defecto de datos
- **THEN** se muestra el número con su signo, sin inventar un valor absoluto

### Requirement: La carga SHALL mostrar la animación del corredor

Mientras una pestaña o período no tenga datos y su request esté en vuelo, la
tarjeta SHALL mostrar una capa de carga con el mismo GIF
`assets/paceron-runner-waiting.gif` que usa el dashboard.

La capa SHALL reutilizar `DashboardLoadingOverlay` o un componente equivalente
que monte el mismo asset y el texto `Cargando métricas…`. NO SHALL crear un
spinner nuevo ni un GIF distinto.

La capa SHALL cubrir solo el contenido de la tarjeta, no el Home completo, y
SHALL impedir tocar las pestañas mientras está visible para evitar requests
superpuestas de la misma tarjeta.

Una revalidación en segundo plano con datos cacheados NO SHALL mostrar la capa;
puede mostrar un indicador discreto de actualización.

#### Scenario: Primera carga de una pestaña

- **WHEN** el corredor abre `Ritmo continuo` y no hay cache
- **THEN** la tarjeta muestra la animación del corredor y el texto `Cargando métricas…`

#### Scenario: Revalidación

- **WHEN** el corredor vuelve a una pestaña que ya tiene datos
- **THEN** los datos permanecen visibles y no aparece la capa de carga

### Requirement: Los estados de error y vacío SHALL ser explícitos

Si la request falla por red o `5xx`, la tarjeta SHALL mostrar un mensaje breve y
un botón `Reintentar` que vuelva a pedir la pestaña y período activos.

Si la API responde `400`, la tarjeta SHALL mostrar un mensaje de error sin botón
de reintento, porque la misma request volvería a fallar. El frontend SHALL enviar
solo valores válidos, así que este estado es una red de seguridad.

Si `has_data=false`, la tarjeta SHALL mostrar las cards con `—` y una nota
`Sin datos en este período.` La tarjeta NO SHALL desaparecer ni mostrar una
pantalla vacía que oculte las pestañas.

Un `401` SHALL seguir el flujo global de sesión del repo y no SHALL renderizar
datos de otro usuario.

#### Scenario: Error de red

- **WHEN** la request falla por timeout
- **THEN** se muestra el mensaje y `Reintentar` vuelve a pedir la misma combinación

#### Scenario: Error de validación

- **WHEN** la API responde `400`
- **THEN** se muestra el mensaje y no se ofrece `Reintentar`

#### Scenario: Período sin datos

- **WHEN** la API responde `has_data=false`
- **THEN** las cards muestran `—` en sus valores y la nota `Sin datos en este período.`

### Requirement: La tarjeta SHALL ser accesible y responsive

Las pestañas SHALL usar roles de tab (`accessibilityRole="tab"` y estado
seleccionado) y SHALL poder activarse con teclado en web. El selector de período
SHALL exponer los tres valores y el activo.

La capa de carga SHALL anunciar su texto con `accessibilityLiveRegion` y SHALL
usar `accessibilityViewIsModal` mientras está visible. Cada card SHALL asociar
su label con su valor de forma legible por lector de pantalla, y su tooltip
SHALL anunciarse al abrirse.

En ancho, la tarjeta SHALL respetar el mismo `max-w-3xl` del contenedor del Home.
En mobile, las tabs SHALL entrar en una línea o permitir scroll horizontal
interno sin desbordar la tarjeta; la grilla NO SHALL generar scroll horizontal.

Cada elemento interactivo nuevo SHALL tener `nativeID` y `testID`, según la regla
`local/require-native-id` del repo.

#### Scenario: Lector de pantalla

- **WHEN** el foco llega a `Ritmo continuo`
- **THEN** se anuncia el label y que está seleccionado

#### Scenario: Mobile angosto

- **WHEN** la tarjeta se muestra en un viewport de 360 px
- **THEN** las cards se leen completas, en mobile entran en dos columnas y no aparece scroll horizontal de página

### Requirement: La consulta SHALL respetar el contrato del backend

El servicio SHALL llamar a:

```http
GET /api/v1/dashboard/runner-kpis?period=<month|week|day>&reference_date=<YYYY-MM-DD>&tab=<tab>
```

El servicio SHALL enviar `reference_date` con la fecha local del dispositivo y
SHALL convertirla a ISO en el borde de la request. El hook SHALL incluir
`period`, `reference_date` y `tab` en la query key; sin eso, el cache devolvería
los números de otra combinación.

La tarjeta SHALL invalidar sus queries al hacer pull-to-refresh en el Home.

El frontend NO SHALL agregar `team_id`, `group_id` ni `athlete_user_id`: el
backend determina el corredor por el token y el alcance es siempre el suyo.

#### Scenario: Query key

- **WHEN** el corredor cambia de `month` a `week`
- **THEN** la nueva request y su cache usan una clave distinta, sin reutilizar la del mes

#### Scenario: Pull to refresh

- **WHEN** el corredor hace pull-to-refresh en el Home
- **THEN** las queries de KPIs se invalidan y la pestaña activa se vuelve a pedir

#### Scenario: Sin parámetros de scope ajenos

- **WHEN** se inspecciona la request
- **THEN** no incluye `team_id`, `group_id` ni `athlete_user_id`

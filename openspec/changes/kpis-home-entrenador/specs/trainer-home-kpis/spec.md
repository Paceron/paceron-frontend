# trainer-home-kpis Specification

## Requirements

### Requirement: Home SHALL presentar KPIs iniciales para el entrenador

Con rol entrenador, el Home SHALL mostrar una tarjeta de resumen que no se
muestre al corredor. SHALL tener los cortes `Mes`, `Semana` y `Día` con la misma
semántica calendario/fecha de referencia que los KPIs del Home del corredor.

En el bloque temporal SHALL mostrar sesiones programadas/realizadas, sesiones
presenciales programadas/realizadas, cobrado neto y pendiente de cobro. En un
bloque separado SHALL mostrar equipos activos y corredores activos únicos, sin
hacerlos depender del período seleccionado.

Los valores SHALL leerse del endpoint de backend; el frontend solo SHALL
normalizar y formatear, sin derivar ni sumar métricas.

#### Scenario: Home con rol entrenador

- **WHEN** el usuario entra al Home con el rol entrenador activo
- **THEN** ve los KPIs de actividad/cobranza y la estructura actual de sus equipos

#### Scenario: Home con rol corredor

- **WHEN** el usuario entra al Home con el rol corredor activo
- **THEN** ve sus módulos existentes y no ve la tarjeta del entrenador

#### Scenario: Cambiar período

- **WHEN** el entrenador elige Mes, Semana o Día
- **THEN** se piden los valores temporales para ese corte y no se mantienen números de otro período
- **AND** los totales actuales de equipos/corredores permanecen iguales

### Requirement: Home SHALL explicar los conteos y el neto

El KPI de sesiones SHALL mostrar `programadas / realizadas`; realizadas significa
que hay al menos una asistencia cargada, no que el calendario haya pasado.
Sesiones presenciales SHALL ser un subconjunto del conteo total. Cobrado neto
SHALL representar cobros aprobados después de la comisión de Paceron. Pendiente
SHALL representar obligaciones con vencimiento en el corte.

#### Scenario: Consultar tooltip de sesiones

- **WHEN** el entrenador abre el tooltip de sesiones
- **THEN** se explica la regla de programada/realizada y la barra expresa programadas / realizadas

#### Scenario: No hay datos

- **WHEN** no existen valores en el período o estructura
- **THEN** los contadores aparecen como cero y los importes con moneda, sin inventar datos

### Requirement: Home SHALL mostrar el GIF en la carga inicial

La tarjeta SHALL reutilizar el GIF/overlay de espera existente mientras llega su
primera respuesta. Al refrescar si ya hay datos, SHALL mantener los valores y
mostrar actualización sin bloquear toda la tarjeta.

#### Scenario: Primera carga

- **WHEN** la primera request del resumen sigue pendiente
- **THEN** aparece el GIF con “Cargando resumen…” y no se interactúa con las cards

#### Scenario: Refresco con datos

- **WHEN** se refetchan datos y hay una respuesta previa
- **THEN** se conservan los valores visibles y no aparece una capa bloqueante

### Requirement: Vistas de Rendimiento SHALL usar el GIF durante cargas iniciales

Las superficies de Métricas/Gráficos, Ranking y Comparación SHALL mostrar el
mismo GIF/overlay mientras se cargan los datos iniciales que necesitan. Una
consulta de fondo con datos previos SHALL NOT tapar la vista; errores SHALL
mostrar el estado de error y no dejar el overlay bloqueando.

#### Scenario: Entrada inicial a métricas/gráficos

- **WHEN** filtros, resumen o series temporales aún no tienen datos al entrar
- **THEN** se ve el overlay GIF hasta que la pantalla puede mostrar contenido o error

#### Scenario: Entrada a Ranking

- **WHEN** se solicita por primera vez la primera página del ranking
- **THEN** el panel de ranking muestra el GIF hasta que carga o falla

#### Scenario: Entrada/consulta de Comparación

- **WHEN** se cargan filtros, roster, opciones A/B, datos de comparación de sesiones o períodos
- **THEN** la superficie de Comparación muestra el GIF durante esa espera

#### Scenario: Refetch de fondo

- **WHEN** hay datos visibles y ocurre sondeo o actualización en segundo plano
- **THEN** la vista no queda cubierta por el overlay

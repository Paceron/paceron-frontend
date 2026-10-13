# Comparar planificado vs realizado — diseño

**Fecha:** 2026-10-13 · **Rama:** `feature/training-comparison` · **Backend:** change de OpenSpec `comparacion-planificado-realizado` (rama `feature/comparacion-planificado-realizado` de `paceron-backend`), Gap 35 de `docs/BACKEND_API_GAPS.md`.

## HU

> Como corredor quiero comparar mis entrenamientos realizados con los planificados para medir mi cumplimiento.

Criterios de aceptación:

1. Acceso a "Comparar entrenamientos" desde el historial o el calendario.
2. Vista comparativa: fecha y hora, tipo, duración planificada vs real, distancia planificada vs real (si aplica), ritmo o intensidad planificada vs real, ejercicios planificados vs realizados.
3. Porcentaje de cumplimiento por sesión.
4. Resumen gráfico del cumplimiento en un rango de fechas.
5. Filtros por tipo de entrenamiento o período.
6. Mensaje claro sin datos: "No hay entrenamientos planificados o realizados para comparar".
7. Mensaje específico ante un error de servidor.
8. Exportar la comparación a PDF y CSV.

## Por qué la comparación la calcula el backend

El detalle de una sesión que ya consume el front (`GET /session-instances/:id`) trae de cada ejercicio solo `repeat_count`, `role` y `rest_minutes`. Los objetivos (minutos, distancia, velocidad, tipo, intensidad) viven en `exercise_instances` y no se exponen al corredor. Además, cruzar el feedback con lo planificado tiene trampas que conviene resolver una sola vez y con tests de Go:

- `workout_feedback.assigned_exercise_id` es el `exercise_instance_id` (no el id de `session_exercise_instances`; en la base coinciden por casualidad en 62 de 95 filas).
- Las filas sincronizadas antes del 2026-09-30 tienen `set_number` en base 0.
- Una serie puede tener una fila del corredor y otra del entrenador.

## Contrato (resumen; detalle en el Gap 35)

- `GET /activities/comparison/:sessionInstanceId` → cabecera (fecha, nombre, equipo, grupo, horario, estado, tipos), `exercises[]` con `planned` y `sets[]` (estado, duración, distancia, ritmo, desviación, cumplimiento), `totals` y `compliance_pct`.
- `GET /activities/comparison?date_from&date_to&team_id&kind` → `sessions[]` con totales y `compliance_pct`, y `summary` (`sessions_planned`, `sessions_with_activity`, `avg_compliance_pct`). Incluye las sesiones planificadas que no se hicieron (0%). El rango es obligatorio, de 366 días como máximo y no puede terminar después de hoy.

## Cumplimiento

Lo calcula el backend; el front solo lo muestra. Por serie, con tope de 100%:

- Completada con minutos: duración real / planificada.
- Completada sin minutos pero con distancia: distancia real / planificada.
- Completada sin objetivo: 100%.
- Salteada o sin registro: 0%.

Ejercicio y sesión: promedio de sus series planificadas. Las series de más se muestran como "extra" y no cuentan. Ejemplo de la HU: caminata completa (100%), segunda caminata a la mitad (50%), tercera salteada (0%) → **50%** de la sesión.

## Entradas

- **Historial** (`components/calendar/trainings-history-tab.jsx`, rol corredor): botón "Comparar entrenamientos" **fuera de la card de filtros, inmediatamente debajo** (pedido explícito). Abre el resumen con el equipo y el rango que ya tenía el historial.
- **Fila del historial**: opción "Comparar con lo planificado" en el menú de la fila, que abre el detalle de esa sesión.
- **Fin de la ejecución** (`training-session-active-screen.jsx` y `training-session-live-screen.jsx`): botón "Ver comparación" en el modal de sesión completada, habilitado cuando la sincronización terminó sin errores (el detalle se arma con lo que ya llegó al backend).

## Pantallas

- **`/training-comparison`** (`components/comparison/training-comparison-screen.jsx`): filtros (Desde, Hasta, Tipo, Equipo), tiles (cumplimiento promedio, sesiones planificadas, sesiones con actividad), gráfico de barras por sesión, lista de sesiones con su % y exportación CSV del rango. Sin rango cargado arranca en los últimos 30 días.
- **`/training-comparison/session`** (`components/comparison/session-comparison-screen.jsx`): cabecera con fecha, horario, tipos y el % grande; una tarjeta por ejercicio con planificado y realizado lado a lado y la desviación por serie; exportación PDF y CSV. Los parámetros van en la URL para sobrevivir a un F5 en web.
- Web ancha: lista en columnas; web angosta y nativo: tarjetas (`useIsNarrowWeb()`).

## Exportación

- **PDF:** HTML puro (`utils/comparison-pdf-html.js`) impreso con el mismo servicio que los comprobantes (`services/receipt`, que en web usa un iframe).
- **CSV:** texto puro (`utils/comparison-csv.js`, separador `;` y BOM para que Excel lo abra bien en español) entregado por `services/csv-export.js` (nativo: archivo con `expo-file-system` y hoja de compartir con `expo-sharing`) y `services/csv-export.web.js` (descarga con un Blob). Ninguno suma módulos nativos nuevos.

## Datos y estado

- `services/activity-comparison.js` con rama `USE_MOCKS` y mock determinístico en `services/__mocks__/activity-comparison-mock.js`.
- Normalizers `toSessionComparisonModel` y `toComparisonListModel`.
- `hooks/use-activity-comparison.js` con TanStack Query; el rango y los filtros van en la query key.

## Fuera de alcance

- La vista del entrenador (el backend ya la soporta con `athlete_user_id`).
- Comparar por plan de entrenamiento.
- El orden del historial (`setOrder` recibe una función en `trainings-history-tab.jsx`, bug aparte).

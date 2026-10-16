# Tasks

> Todas las tareas de instrumentación (grupo 6) se escriben **antes** de la verificación en
> dispositivo (grupo 7): sin logs, la corrida real no dice nada y el resultado queda otra
> vez en el terreno de las hipótesis.

## 1. Filtro de ruido por ancla (`utils/distance.js`)

- [ ] 1.1 Agregar `MIN_DISPLACEMENT_METERS` y `NOISE_FACTOR` exportados, con el criterio
      escrito en el comentario (ancla estable vs. punto anterior, y por qué el umbral tiene
      que ser escalado por `accuracy`). Verificar: el archivo exporta ambas constantes.
- [ ] 1.2 Separar la evaluación de un punto de la de un tramo: una función que decide si un
      punto es usable como ancla (coordenadas, timestamp y `accuracy` dentro del máximo) y
      otra que evalúa el desplazamiento de un punto contra el ancla. Verificar: ambas son
      puras, sin `Date.now()` ni estado.
- [ ] 1.3 Reescribir la evaluación del tramo para que mida contra el ancla y devuelva la
      distancia del tramo **ancla→punto** cuando supera el umbral, y `null` cuando no.
      Verificar: un tramo largo entre dos puntos lejanos con un punto intermedio de ruido
      cuenta la distancia completa, no la del último tramo.
- [ ] 1.4 Cerrar el hueco de `elapsedSeconds <= 0`: devolver `null` en vez de aceptar el
      tramo sin verificar. Verificar: test con dos puntos de idéntico `timestamp` devuelve
      `null`.
- [ ] 1.5 Preservar el comportamiento de descarte por `accuracy` excessive y por velocidad
      implícita, sin cambiar sus constantes actuales. Verificar: los tests existentes de
      `__tests__/distance.test.js` que cubren esos dos casos siguen en verde sin haberlos
      tocado.

## 2. Regresión de standing-still

- [ ] 2.1 Test de 60 puntos con jitter acotado alrededor de un origen fijo y `accuracy`
      chica: la distancia total SHALL dar 0. Verificar: el test falla con la función actual
      (por eso es una regresión real) y pasa con la nueva.
- [ ] 2.2 Test de recorrido legítimo: puntos separados 10 m con `accuracy` de 5 m, la
      distancia total SHALL coincidir con la longitud del recorrido dentro del margen del
      umbral. Verificar: pasa, y el margen esperado está escrito en el test.
- [ ] 2.3 Test del caso que hoy no tiene cobertura: `accuracy` ausente o no finito cae al
      piso `MIN_DISPLACEMENT_METERS` en vez de romper. Verificar: pasa.
- [ ] 2.4 Test de que un tramo largo con Δt grande (pausa) no se acepta como movimiento por
      el filtro de velocidad. Verificar: pasa.
- [ ] 2.5 `npm test` en verde. Verificar: la suite completa pasa.

## 3. Un solo watcher por sesión

- [ ] 3.1 Subir el tracker al componente de pantalla de `training-session-active-screen.jsx`,
      junto al boot del run, con el watcher arrancando al bootear y liberándose al
      desmontar. Verificar: no queda ningún `watchPositionAsync` en el subtree de
      `SeriesView`.
- [ ] 3.2 Mover el handler de puntos a la pantalla, con el acumulador como
      `Map<setId, metros>` (la misma forma que ya usa el flujo presencial) y el gate por
      fase/serie activa equivalente a `use-live-session-runtime.js:165`. Verificar: la
      distancia de una serie no se filtra a otra.
- [ ] 3.3 `SeriesView` deja de instanciar el tracker y de llamar `gps.stop()` en pausa,
      pausa/reanudación y fin; recibe los puntos por prop. Verificar: `SeriesView` no
      importa `use-gps-tracker`.
- [ ] 3.4 Borrar `hooks/use-gps-tracker.js` y su `getInitialPoint` muerto, y actualizar los
      comentarios que lo citan (`use-session-gps-tracker.js:4-9`,
      `session-pre-start-screen.jsx:153`). Verificar: `grep -rn "use-gps-tracker"` no
      devuelve nada.
- [ ] 3.5 Limpiar la referencia (ancla) en arranque de serie, fin de serie, serie y
      ejercicio salteados, pausa y reanudación — en los dos flujos. El hueco de pausa/reanudación
      es el que hoy está abierto. Verificar: `grep` de los seis puntos de reset en cada flujo.
- [ ] 3.6 `npm run lint` en verde. Verificar: la regla `local/require-native-id` no salta
      con los props nuevos del handler de puntos.

## 4. Sincronización: no perder ni descartar series

- [ ] 4.1 Nueva función pura en `utils/` que, dado el listado de feedbacks de la sesión y la
      serie local en conflicto, resuelva `{ feedbackId, editPayload }` o `null` si no
      encuentra la fila. Verificar: es pura, sin `fetch` ni SQLite, y su test pasa.
- [ ] 4.2 Agregar `completion_status` como campo opcional de `toFeedbackEditPayload`
      (`services/normalizers.js:832`), emitido solo cuando lo pasa el llamador. Verificar:
      el test existente de `normalizers` sigue en verde sin cambios, y un test nuevo cubre
      que se emite cuando se pasa y se omite cuando no.
- [ ] 4.3 Tests de la resolución de conflicto: coincidence por número de serie, por
      ejercicio, y `null` cuando no hay fila. Verificar: pasan.
- [ ] 4.4 `services/session-sync.js`: ante 409, listar los feedbacks de la sesión, resolver
      el id y hacer PATCH con los valores actuales; contar como sincronizada y registrar el
      conflicto en un desglose aparte. Verificar: no queda ninguna rama que marque `synced`
      sin haber escrito los datos.
- [ ] 4.5 `services/session-sync.js`: tolerar 409 en el create del `runner_session` igual
      que ya se tolera en el `finish`, y seguir con el loop de series. Verificar: con un
      409 en el create, el loop de series se ejecuta igual.
- [ ] 4.6 `services/session-sync.js`: no abortar el loop ante errores no-409; acumular la
      serie como pendiente con su error y seguir. Verificar: con una serie que falla, las
      demás se envían.
- [ ] 4.7 Cambiar el retorno a `{ synced, recovered, pending }` y actualizar los dos call
      sites (`training-session-active-screen.jsx:471`, `use-live-session-runtime.js:203`).
      Verificar: `grep -rn "\.conflicts" components/ hooks/` no queda ninguna referencia.
- [ ] 4.8 Reiniciar el latch de `startedRef` en `SessionCompleteModal` cuando cambia el
      `runId`, para que un `syncRun` con `runId` null no reporte éxito con cero subidas.
      Verificar: abrir el modal sin `runId` listo no muestra toast de éxito.
- [ ] 4.9 `npm test` + `npm run lint` en verde. Verificar: ambos en verde.

## 5. Reporte de salida

- [ ] 5.1 `SessionCompleteModal`: un conflicto o un pendiente pasa a toast de advertencia
      con el conteo real; el de éxito solo cuando no hay ninguno de los dos. Verificar: un
      sync con una serie pendiente muestra "quedó incompleta", no "Sincronizada".
- [ ] 5.2 Cancelación (`handleCancelConfirmed`) alineada con el mismo criterio: informar
      pendientes en vez de contarlos como sincronizados. Verificar: revisión del texto del
      toast contra el caso de la sesión completa.
- [ ] 5.3 `npm run lint` en verde. Verificar: verde.

## 6. Instrumentación

- [ ] 6.1 Log por serie al finalizar, con `wallMs`, `activeMs`, `distanceMeters` —los
      valores exactos que se persisten— y la cantidad de puntos GPS aceptados. Va en los
      dos flujos. Verificar: `logDebug` presente en ambos paths de fin de serie.
- [ ] 6.2 Log por tramo **aceptado** durante los primeros puntos de cada serie, con `leg`,
      `accuracy` y `Δt`. Hoy solo se loguean los descartados. Verificar: se ve el tramo que
      mueve la ancla.
- [ ] 6.3 `DebugLogPanel` montado también en `training-session-live-screen.jsx`, que hoy no
      lo tiene. Verificar: el panel aparece en la pantalla presencial con `__DEV__`.
- [ ] 6.4 Ampliar el log de `syncRun` en el flujo presencial con el desglose nuevo
      (subidas / recuperadas / pendientes). Verificar: el log distingue un 409 recuperado de
      una subida limpia.
- [ ] 6.5 `npm run lint` en verde. Verificar: el panel no rompe la regla de `nativeID`.

## 7. Verificación

- [ ] 7.1 `npm test` completo y `npm run lint` en verde. Verificar: ambos en verde, sin
      tests salteados ni warnings nuevos.
- [ ] 7.2 Correr en **Android por dev client** (`npm run android:run` — no sirve Expo Go
      desde que el proyecto tiene módulo nativo) una sesión asíncrona de al menos 3 series
      con el teléfono quieto al menos 30 s en la primera. Verificar en el log: la distancia
      de cada serie queda en 0 mientras está quieto, y sube solo al moverse.
- [ ] 7.3 Confirmar en el log de la misma corrida que el watcher no se reabre entre series
      (una sola línea de arranque, no tres). Verificar: el log del tracker muestra un
      arranque por sesión.
- [ ] 7.4 Confirmar que la serie 1 de esa corrida llega a la revisión con sus valores. Si no
      llega, el log de 6.1/6.4 dice si el problema fue local (valores vacíos al persistir)
      o de sync (payload bien pero POST rechazado), y eso cierra la pregunta abierta del
      design.
- [ ] 7.5 Si hubo 409, levantar las filas del `session_instance` afectado para ver si la
      recuperación actualizó la fila vieja en vez de crear una nueva:
      `SELECT assigned_exercise_id, set_number, completion_status, duration_ms, distance_meters, updated_at FROM workout_feedback WHERE assigned_session_id = <id> AND deleted_at IS NULL ORDER BY assigned_exercise_id, set_number;`
      Verificar: una fila por serie, con los valores de la corrida.
- [ ] 7.6 Correr la misma sesión en el flujo presencial y confirmar que el comportamiento
      no se rompió (antes-era el que funcionaba). Verificar: quieto da 0, corriendo cuenta,
      y la serie llega a la revisión.
- [ ] 7.7 Ajustar `NOISE_FACTOR` / `MIN_DISPLACEMENT_METERS` con lo observado en 7.2 si
      hace falta, y re-correr el test de standing-still. Verificar: el test sigue en verde
      con el valor ajustado.
- [ ] 7.8 `CLAUDE.md`: actualizar la nota de `acceptGpsLeg` en "Quirks conocidos", que hoy
      describe los filtros de 30 m y 12 m/s como la defensa contra el ruido de
      standing-still y deja de ser cierto. Dejar escrito que el umbral se mide contra el
      ancla y por qué no contra el punto anterior, para que el próximo no lo "simplifique".
      Verificar: la nota no afirma que los dos filtros old bastan.

## 8. Cierre

- [ ] 8.1 Commit por grupo, subject en inglés y cuerpo en español si el "por qué" no es
      obvio del diff. **Sin push/merge.**
- [ ] 8.2 Abrir PR a `develop` con el formato de `CLAUDE.md` (Qué cambió / Cómo probarlo),
      mencionando explícitamente que la confirmación final del fix de sync y de las
      constantes del filtro es la corrida de 7.2-7.6. Verificar: la PR describe que el
      cálculo de "hoy" del calendario y la variable de bypass quedan en el repo del
      backend, no acá.

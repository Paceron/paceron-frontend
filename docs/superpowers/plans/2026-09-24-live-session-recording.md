# Plan — Registro de actividad en vivo (toma de series: cronómetro, GPS, SQLite, sync)

Spec: `docs/superpowers/specs/2026-09-24-live-session-recording-design.md`
Repo frontend: `paceron-frontend` (rama `feature/live-session-recording`).
Repo backend: `paceron-backend` (change OpenSpec aparte, ver tasks finales).

## Fase 1 — Fundaciones frontend

- [ ] Instalar `npx expo install expo-sqlite` (SDK 54 → ~19.x) y verificar que no rompe el bundle
      web en el preview (el quirk de ESM aplica a librerías web — expo-sqlite es un paquete de
      Expo, debería estar OK; si rompe Metro, revisar antes de seguir).
- [ ] `utils/distance.js` — `haversineMeters(lat1, lng1, lat2, lng2)` (radio terrestre 6371000 m).
- [ ] `utils/time.js` — `pad2`, `formatStopwatch(ms)` → `MM:SS:CC`.
- [ ] `utils/session-sync-payload.js` — `buildSetPayload({ set, run })` puro (coerción de ids a
      Number, `completion_status` de `set.status`, campos nulos para sets skipped);
      `buildPointsPayload({ set, points })` puro (agrega `session_instance_id` y
      `exercise_instance_id` a cada punto).
- [ ] `__tests__/distance.test.js`, `__tests__/time.test.js`,
      `__tests__/session-sync-payload.test.js` — `npm test` en verde.

## Fase 2 — Persistencia local (SQLite)

- [ ] `services/session-db.js` — init (`PRAGMA journal_mode=WAL` + `CREATE TABLE IF NOT EXISTS`),
      DAO completo de la spec (run + sets + gps_points; createRun siembra todas las series;
      getActiveRun por `(session_instance_id, session_date, athlete_user_id)` para reanudar).
- [ ] `store/live-session-store.js` — `runId`, `gpsEnabled`, clear.

## Fase 3 — Hooks de runtime

- [ ] `hooks/use-stopwatch.js` — `start`/`pause`/`resume`/`reset`, `wallMs`/`activeMs`, tick ~50 ms
      con base de timestamps.
- [ ] `hooks/use-gps-tracker.js` — `start({ onPoint })`/`stop()` sobre
      `Location.watchPositionAsync` (no pide permisos; no-op si `!enabled`).

## Fase 4 — Pantalla activa

- [ ] Permiso de GPS único en `session-pre-start-screen.jsx` (Play → `requestForegroundPermissionsAsync`
      → `gpsEnabled` en store → navegar).
- [ ] `components/session-runtime/training-session-active-screen.jsx` — reemplaza el stub:
      guard de entrada (`pendingSession`/`isWeb` → `Redirect`), init DB + resume/crear run,
      vista *Resumen* (ejercicios + chips de serie, solo el próximo clickeable, STOP de 3 s).
- [ ] Vista *Serie* (dentro de la misma ruta): título, `Serie X de Y`, cronómetro,
      PLAY/cuenta regresiva 5 s/PAUSE/resume, SKIP (mini-menú serie/ejercicio),
      FINISH de 2 toques, resumen de serie, avance automático.
- [ ] Cancelación: modal hold-3 s → confirmación (`notifyWarning`, patrón
      `delete-training-plan-modal.jsx`); set en vuelo → `interrupted`; run → `cancelled`.
- [ ] Flujo final: última serie → modal "Sesión completada" + botón Sincronizar → sync con toast/
      retry; `router.back()` al cerrar.

## Fase 5 — Sync

- [ ] `services/workoutFeedback.js` + `services/__mocks__/workoutFeedback-mock.js` —
      `createWorkoutFeedback` / `createWorkoutFeedbackPoints` (patrón `services/calendar.js`).
- [ ] `services/session-sync.js` — loop por sets no syncados; 409 → markSynced; red/5xx → cortar;
      `{ synced, conflicts, errors }`.
- [ ] `npm test` + `npm run lint` en verde.

## Fase 6 — Backend (paceron-backend, change OpenSpec)

- [ ] Artifacts `openspec/changes/live-session-feedback-points/{proposal,design,tasks}.md`.
- [ ] Tabla `workout_feedback_points` (postgres.go — AutoMigrate + índice único compuesto).
- [ ] Domain struct + DAO + Service + Controller + rutas (`POST`/`GET /api/v1/workout-feedback/:id/points`),
      matriz de auth del módulo, `ON CONFLICT DO NOTHING`.
- [ ] Tests (`testify`, patrón de `workout_feedback_*_test.go`) + `go test ./...` verde.

## Verificación final

- [ ] `npm test`, `npm run lint` (frontend) y `go test ./...` (backend) en verde.
- [ ] Flujo manual en dispositivo (dev client): crear run, serie con countdown/PAUSE, GPS con
      permiso y sin, SKIP serie y ejercicio, cancelar a mitad, completar y sync (incl. 409`.
- [ ] Actualizar `docs/BACKEND_API_GAPS.md` (Gap 12, guardado resuelto parcialmente) y
      `CLAUDE.md` (quirk expo-sqlite) si aplica.
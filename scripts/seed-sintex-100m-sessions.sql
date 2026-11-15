-- Datos de demo para la pantalla Comparación (Rendimiento → Comparación → Sesiones A/B).
--
-- Corredor: SINTEX DEV (public.users.id = 24), team 29 ("Animals"), grupo 39.
-- Ejercicio: "100 mts planos" (catálogo id = 13, kind = velocidad_distancia).
--
-- Deja 5 ejecuciones comparables del mismo ejercicio, en sesiones YA existentes
-- del calendario (session_instances 48, 45, 55, 46, 47), cada una con 4 series
-- válidas y tiempos distintos para que el A/B tenga algo real que comparar:
--
--   sesión 48 · 24/09  (baseline, la más lenta)
--   sesión 45 · 25/09
--   sesión 55 · 26/09
--   sesión 46 · 27/09
--   sesión 47 · 28/09  (la más rápida)
--
-- Cada sesión tiene dos ExerciseInstance de "100 mts planos" con repeat_count 2.
-- Para que la comparación muestre "Serie 1, 2, 3, 4" (la UI rotula con
-- set_number, sin prefijo por instancia), la primera instancia lleva set_number
-- 1 y 2, y la segunda 3 y 4. Las filas se insertan con set_number 1-indexado,
-- como espera el backend actual.
--
-- Los tiempos se eligieron para que las CUATRO series de cada sesión muestren
-- segundos distintos: la UI formatea la duración como MM:SS (trunca, no redondea),
-- así que dos tiempos dentro del mismo segundo se verían iguales.
--
-- OJO con la sesión 48: su fila de workout_feedback se etiqueta 24/09 (lo que se
-- ve en el selector "sesión 48 · 24/09"), pero su día de calendario en
-- group_calendar_days es 23/09. El endpoint de candidatas filtra por la fecha de
-- CALENDARIO, así que el rango A/B tiene que incluir el 23/09 para que la sesión
-- 48 aparezca en la lista.
--
-- Uso (la DB de develop vive en Supabase; DATABASE_URL está en el .env del
-- backend):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/seed-sintex-100m-sessions.sql
--
-- Es idempotente: borra SOLO las filas de este corredor/ejercicio/sesiones antes
-- de insertar, así que se puede correr las veces que haga falta.

BEGIN;

DELETE FROM public.workout_feedback
WHERE deleted_at IS NULL
  AND athlete_user_id = 24
  AND feedback_owner_user_id = 24
  AND (assigned_session_id, assigned_exercise_id) IN (
    (48, 237), (48, 239),
    (45, 222), (45, 224),
    (55, 272), (55, 274),
    (46, 227), (46, 229),
    (47, 232), (47, 234)
  );

INSERT INTO public.workout_feedback (
  team_id,
  assigned_session_id,
  assigned_exercise_id,
  athlete_user_id,
  feedback_owner_user_id,
  report_source,
  session_date,
  set_number,
  started_at,
  ended_at,
  duration_ms,
  active_duration_ms,
  distance_meters,
  rpe,
  completion_status,
  pace_sec_per_km
) VALUES
  -- 24/09 · sesión 48 · baseline (la más lenta)
  -- Series: 18 s · 19 s · 20 s · 17 s
  (29, 48, 237, 24, 24, 'corredor', DATE '2026-09-24', 1, TIMESTAMPTZ '2026-09-24 12:00:00-03', TIMESTAMPTZ '2026-09-24 12:00:19.300-03', 19300, 18600, 100, 8, 'completa', 186.0),
  (29, 48, 237, 24, 24, 'corredor', DATE '2026-09-24', 2, TIMESTAMPTZ '2026-09-24 12:03:00-03', TIMESTAMPTZ '2026-09-24 12:03:20.100-03', 20100, 19400, 100, 8, 'completa', 194.0),
  (29, 48, 239, 24, 24, 'corredor', DATE '2026-09-24', 3, TIMESTAMPTZ '2026-09-24 12:06:00-03', TIMESTAMPTZ '2026-09-24 12:06:20.900-03', 20900, 20200, 100, 9, 'completa', 202.0),
  (29, 48, 239, 24, 24, 'corredor', DATE '2026-09-24', 4, TIMESTAMPTZ '2026-09-24 12:09:00-03', TIMESTAMPTZ '2026-09-24 12:09:18.000-03', 18000, 17300, 100, 8, 'completa', 173.0),

  -- 25/09 · sesión 45
  -- Series: 17 s · 18 s · 19 s · 16 s
  (29, 45, 222, 24, 24, 'corredor', DATE '2026-09-25', 1, TIMESTAMPTZ '2026-09-25 12:00:00-03', TIMESTAMPTZ '2026-09-25 12:00:18.100-03', 18100, 17400, 100, 8, 'completa', 174.0),
  (29, 45, 222, 24, 24, 'corredor', DATE '2026-09-25', 2, TIMESTAMPTZ '2026-09-25 12:03:00-03', TIMESTAMPTZ '2026-09-25 12:03:18.900-03', 18900, 18200, 100, 8, 'completa', 182.0),
  (29, 45, 224, 24, 24, 'corredor', DATE '2026-09-25', 3, TIMESTAMPTZ '2026-09-25 12:06:00-03', TIMESTAMPTZ '2026-09-25 12:06:19.800-03', 19800, 19100, 100, 9, 'completa', 191.0),
  (29, 45, 224, 24, 24, 'corredor', DATE '2026-09-25', 4, TIMESTAMPTZ '2026-09-25 12:09:00-03', TIMESTAMPTZ '2026-09-25 12:09:17.000-03', 17000, 16300, 100, 8, 'completa', 163.0),

  -- 26/09 · sesión 55
  -- Series: 15 s · 16 s · 17 s · 14 s
  (29, 55, 272, 24, 24, 'corredor', DATE '2026-09-26', 1, TIMESTAMPTZ '2026-09-26 12:00:00-03', TIMESTAMPTZ '2026-09-26 12:00:16.500-03', 16500, 15800, 100, 8, 'completa', 158.0),
  (29, 55, 272, 24, 24, 'corredor', DATE '2026-09-26', 2, TIMESTAMPTZ '2026-09-26 12:03:00-03', TIMESTAMPTZ '2026-09-26 12:03:17.600-03', 17600, 16900, 100, 8, 'completa', 169.0),
  (29, 55, 274, 24, 24, 'corredor', DATE '2026-09-26', 3, TIMESTAMPTZ '2026-09-26 12:06:00-03', TIMESTAMPTZ '2026-09-26 12:06:18.300-03', 18300, 17600, 100, 9, 'completa', 176.0),
  (29, 55, 274, 24, 24, 'corredor', DATE '2026-09-26', 4, TIMESTAMPTZ '2026-09-26 12:09:00-03', TIMESTAMPTZ '2026-09-26 12:09:15.400-03', 15400, 14700, 100, 8, 'completa', 147.0),

  -- 27/09 · sesión 46
  -- Series: 14 s · 15 s · 16 s · 13 s
  (29, 46, 227, 24, 24, 'corredor', DATE '2026-09-27', 1, TIMESTAMPTZ '2026-09-27 12:00:00-03', TIMESTAMPTZ '2026-09-27 12:00:15.300-03', 15300, 14600, 100, 8, 'completa', 146.0),
  (29, 46, 227, 24, 24, 'corredor', DATE '2026-09-27', 2, TIMESTAMPTZ '2026-09-27 12:03:00-03', TIMESTAMPTZ '2026-09-27 12:03:16.100-03', 16100, 15400, 100, 8, 'completa', 154.0),
  (29, 46, 229, 24, 24, 'corredor', DATE '2026-09-27', 3, TIMESTAMPTZ '2026-09-27 12:06:00-03', TIMESTAMPTZ '2026-09-27 12:06:16.900-03', 16900, 16200, 100, 9, 'completa', 162.0),
  (29, 46, 229, 24, 24, 'corredor', DATE '2026-09-27', 4, TIMESTAMPTZ '2026-09-27 12:09:00-03', TIMESTAMPTZ '2026-09-27 12:09:14.500-03', 14500, 13800, 100, 8, 'completa', 138.0),

  -- 28/09 · sesión 47 · la más rápida
  -- Series: 13 s · 14 s · 15 s · 12 s
  (29, 47, 232, 24, 24, 'corredor', DATE '2026-09-28', 1, TIMESTAMPTZ '2026-09-28 12:00:00-03', TIMESTAMPTZ '2026-09-28 12:00:14.200-03', 14200, 13500, 100, 9, 'completa', 135.0),
  (29, 47, 232, 24, 24, 'corredor', DATE '2026-09-28', 2, TIMESTAMPTZ '2026-09-28 12:03:00-03', TIMESTAMPTZ '2026-09-28 12:03:14.800-03', 14800, 14100, 100, 9, 'completa', 141.0),
  (29, 47, 234, 24, 24, 'corredor', DATE '2026-09-28', 3, TIMESTAMPTZ '2026-09-28 12:06:00-03', TIMESTAMPTZ '2026-09-28 12:06:16.000-03', 16000, 15300, 100, 9, 'completa', 153.0),
  (29, 47, 234, 24, 24, 'corredor', DATE '2026-09-28', 4, TIMESTAMPTZ '2026-09-28 12:09:00-03', TIMESTAMPTZ '2026-09-28 12:09:13.400-03', 13400, 12700, 100, 8, 'completa', 127.0);

COMMIT;

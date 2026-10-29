# Mapa real + layout desktop en session-review-screen.jsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el dibujo SVG abstracto de trayectoria (`TrajectorySketch`) por un mapa real en el detalle de serie de `session-review-screen.jsx`, reorganizar esa vista en dos columnas en desktop (mapa de un lado, datos del otro), y una pasada de pulido visual — mismo mecanismo de mapa ya construido para las pantallas en vivo de esta rama.

**Architecture:** Un componente nuevo (`SeriesTrajectoryMap`) que envuelve `LiveTrajectoryMap` con el mismo fetch bajo demanda que ya usaba el sketch viejo (`getWorkoutFeedbackPoints(feedbackId)`, sin cambios de servicio/backend). `SetDetailView` pasa a dos columnas en ventana ancha (`useIsNarrowWeb()`), apilado en angosto/mobile sin cambios.

**Tech Stack:** React Native + Expo, `@maplibre/maplibre-react-native`/`maplibre-gl` (vía `LiveTrajectoryMap`, ya existente), NativeWind, `react-native-reanimated`.

**Spec:** `docs/superpowers/specs/2026-10-29-session-review-real-map-design.md`

## Global Constraints

- `session-review-screen.jsx` NO es `MobileOnlyRoute` — multiplataforma, alcanzable en preview web.
- `getWorkoutFeedbackPoints(feedbackId)` no cambia — ya devuelve `{latitude, longitude, ...}` por punto, confirmado contra `utils/trajectory.js#buildTrajectoryPath` (mismo campo, mismo service, sin tocar `services/runnerSession.js`).
- `hideReferenceLine` en `LiveTrajectoryMap` ya existe (prop aditiva de un plan anterior de esta misma rama) — no hace falta ningún cambio en `live-trajectory-map.jsx`/`.web.jsx` para este plan.
- Sin tests de render de componentes (convención del repo) — verificación manual en preview.
- La silueta de TODA la sesión (todas las series combinadas) queda fuera de alcance — ver spec, sección "Fuera de alcance".

---

### Task 1: `SeriesTrajectoryMap` — componente nuevo

**Files:**
- Create: `components/session-runtime/series-trajectory-map.jsx`

**Interfaces:**
- Consumes: `getWorkoutFeedbackPoints` (`services/runnerSession.js`, ya existe, firma `getWorkoutFeedbackPoints(feedbackId) -> Promise<{data: Array<{latitude, longitude, ...}>}>`); `LiveTrajectoryMap` (`components/session-runtime/live-trajectory-map.jsx`, ya existe, props `traveledPoints`/`referenceRoute`/`hideReferenceLine`/`currentPosition`/`currentUserPhotoUrl`/`currentUserInitials`).
- Produces: `SeriesTrajectoryMap({ feedbackId, pointsCount })` — mismo contrato de entrada que `TrajectorySketch` (lo reemplaza), consumido por Task 2.

- [ ] **Step 1: Crear el componente**

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/colors.js';
import { getWorkoutFeedbackPoints } from '../../services/runnerSession.js';
import { LiveTrajectoryMap } from './live-trajectory-map';

// Mapa real de una serie ya registrada -- reemplaza al dibujo abstracto que
// tenía trajectory-sketch.jsx, con el mismo mapa real que ya usan las
// pantallas en vivo y el detalle de intento de competencia
// (LiveTrajectoryMap). Mismo fetch bajo demanda que ya tenía el sketch viejo
// (GET /workout-feedback/:id/points por feedbackId, un fetch por serie, a
// propósito -- ver docs/superpowers/specs/2026-10-29-session-review-real-map-design.md,
// "Qué cambió respecto a la idea original": no hay forma de traer varias
// series de una sin pedir de más).
//
// `hideReferenceLine` siempre activo -- no hay "ruta planificada" que
// mostrar acá, solo lo que pasó. Inicio Y fin SIEMPRE presentes (a
// diferencia del mapa en vivo de las pantallas de sesión, acá la serie ya
// terminó, nunca hay un "todavía no se sabe el fin"). Sin `currentPosition`
// -- no hay avatar de posición en vivo, es historial.
export function SeriesTrajectoryMap({ feedbackId, pointsCount }) {
  const colors = useThemeColors();
  const [state, setState] = useState({ loading: false, points: null, error: null });

  useEffect(() => {
    if (!feedbackId || !pointsCount) return;
    let cancelled = false;
    setState({ loading: true, points: null, error: null });
    getWorkoutFeedbackPoints(feedbackId)
      .then((res) => {
        if (cancelled) return;
        setState({ loading: false, points: res?.data ?? [], error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ loading: false, points: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [feedbackId, pointsCount]);

  if (!pointsCount) {
    return (
      <View className="mt-3" nativeID="session-review-trajectory" testID="session-review-trajectory">
        <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID="session-review-trajectory-empty" testID="session-review-trajectory-empty">
          Esta serie se registró sin GPS, no hay trayectoria para dibujar.
        </Text>
      </View>
    );
  }

  if (state.loading) {
    return (
      <View className="items-center justify-center py-10" nativeID="session-review-trajectory-loading" testID="session-review-trajectory-loading">
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  if (state.error || !state.points || state.points.length < 2) {
    return (
      <View className="mt-3" nativeID="session-review-trajectory-error" testID="session-review-trajectory-error">
        <Text className="text-xs text-amber-600 dark:text-amber-400" nativeID="session-review-trajectory-error-label" testID="session-review-trajectory-error-label">
          No pudimos dibujar la trayectoria.
        </Text>
      </View>
    );
  }

  const startPoint = state.points[0];
  const endPoint = state.points[state.points.length - 1];
  const referenceRoute = {
    type: 'LineString',
    coordinates: [
      [startPoint.longitude, startPoint.latitude],
      [endPoint.longitude, endPoint.latitude],
    ],
  };

  return (
    <View className="mt-3 h-60" nativeID="session-review-trajectory" testID="session-review-trajectory">
      <LiveTrajectoryMap hideReferenceLine referenceRoute={referenceRoute} traveledPoints={state.points} />
    </View>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npm test && npm run lint`
Expected: sin fallos nuevos (componente presentacional, sin tests de render en este repo).

- [ ] **Step 3: Commit**

```bash
git add components/session-runtime/series-trajectory-map.jsx
git commit -m "feat(session-runtime): add SeriesTrajectoryMap, real-map replacement for the SVG sketch"
```

---

### Task 2: `session-review-screen.jsx` — cablear el mapa, layout desktop, pulido

**Files:**
- Modify: `components/session-runtime/session-review-screen.jsx`

**Interfaces:**
- Consumes: `SeriesTrajectoryMap` (Task 1); `useIsNarrowWeb` (`hooks/use-is-narrow-web.js`, ya existe, `useIsNarrowWeb() -> boolean`).

- [ ] **Step 1: Imports**

Reemplazar:

```js
import { DateField, DurationField, InputField, TimeField } from '../forms/fields.jsx';
import { TrajectorySketch } from './trajectory-sketch.jsx';
import { VoiceAnnotationControls } from './voice-annotation-controls.jsx';
```

por:

```js
import { DateField, DurationField, InputField, TimeField } from '../forms/fields.jsx';
import { SeriesTrajectoryMap } from './series-trajectory-map.jsx';
import { VoiceAnnotationControls } from './voice-annotation-controls.jsx';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import Animated, { FadeIn } from 'react-native-reanimated';
```

- [ ] **Step 2: Accesibilidad en el back button de `ReviewListView`**

Reemplazar:

```jsx
          <Pressable className="h-9 w-9 items-center justify-center self-start rounded-full active:opacity-70" nativeID="session-review-screen-back-button" onPress={() => router.back()} testID="session-review-screen-back-button">
```

por:

```jsx
          <Pressable accessibilityLabel="Volver" className="h-9 w-9 items-center justify-center self-start rounded-full active:opacity-70" nativeID="session-review-screen-back-button" onPress={() => router.back()} testID="session-review-screen-back-button">
```

- [ ] **Step 3: `useIsNarrowWeb` dentro de `SetDetailView`**

Agregar, al inicio de `SetDetailView` (junto a `const colors = useThemeColors();`):

```js
  const isNarrowWeb = useIsNarrowWeb();
```

- [ ] **Step 4: Accesibilidad en el back button del detalle**

Reemplazar:

```jsx
        <Pressable className="h-9 w-9 items-center justify-center self-start rounded-full active:opacity-70" nativeID="session-review-detail-back-button" onPress={handleBack} testID="session-review-detail-back-button">
```

por:

```jsx
        <Pressable accessibilityLabel="Volver" className="h-9 w-9 items-center justify-center self-start rounded-full active:opacity-70" nativeID="session-review-detail-back-button" onPress={handleBack} testID="session-review-detail-back-button">
```

- [ ] **Step 5: Ancho del contenedor -- más espacio en ventana ancha para las dos columnas**

Reemplazar:

```jsx
      <ScrollView className={`flex-1 w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} contentContainerClassName="px-4 py-6" nativeID="session-review-detail-scroll" testID="session-review-detail-scroll">
```

por:

```jsx
      <ScrollView className={`flex-1 w-full self-center ${!isWeb ? '' : isNarrowWeb ? 'max-w-3xl' : 'max-w-5xl'}`} contentContainerClassName="px-4 py-6" nativeID="session-review-detail-scroll" testID="session-review-detail-scroll">
```

- [ ] **Step 6: Reemplazar el bloque de campos + metadatos + trayectoria + acciones**

Reemplazar desde `<View className="mb-4 gap-2.5" nativeID="session-review-detail-fields" ...>` (el bloque de los 6 `DataField`) hasta el cierre de `{editable && (...)}` (las acciones), es decir todo este tramo:

```jsx
        <View className="mb-4 gap-2.5" nativeID="session-review-detail-fields" testID="session-review-detail-fields">
          <DataField
            editable={editable}
            editing={editing}
            id={`${fieldId}-started`}
            label="Inicio (started_at)"
            onToggleEdit={() => setEditing((v) => !v)}
          >
            {editing ? (
              <View className="gap-2" nativeID={`${fieldId}-started-editor`} testID={`${fieldId}-started-editor`}>
                <DateField
                  disableFutureLimit
                  label="Fecha de inicio"
                  onChange={handleStartDateChange}
                  value={startedDate}
                />
                <TimeField
                  className="mb-0"
                  hideErrorRow
                  label="Hora de inicio"
                  onChange={handleStartTimeChange}
                  value={startedTime}
                />
              </View>
            ) : (
              formatDayTime(feedback?.startedAt)
            )}
          </DataField>

          <DataField
            editable={editable}
            editing={editing}
            id={`${fieldId}-ended`}
            label="Fin (ended_at)"
            onToggleEdit={() => setEditing((v) => !v)}
          >
            {editing ? (
              <View className="gap-2" nativeID={`${fieldId}-ended-editor`} testID={`${fieldId}-ended-editor`}>
                <DateField
                  disableFutureLimit
                  label="Fecha de fin"
                  onChange={handleEndDateChange}
                  value={endedDate}
                />
                <TimeField
                  className="mb-0"
                  hideErrorRow
                  label="Hora de fin"
                  onChange={handleEndTimeChange}
                  value={endedTime}
                />
              </View>
            ) : (
              formatDayTime(feedback?.endedAt)
            )}
          </DataField>

          <DataField
            editable={editable}
            editing={editing}
            hint={durationHint}
            id={`${fieldId}-duration`}
            label="Duración"
            onToggleEdit={() => setEditing((v) => !v)}
          >
            {editing ? (
              <DurationField
                className="mb-0"
                hideErrorRow
                hideLabel
                label="Duración"
                onChange={setDurationText}
                placeholder="330 → 3:30"
                value={durationText}
              />
            ) : (
              displayDuration(feedback?.durationMs)
            )}
          </DataField>

          <DataField
            editable={editable}
            editing={editing}
            id={`${fieldId}-active`}
            label="Tiempo activo (active_duration_ms)"
            onToggleEdit={() => setEditing((v) => !v)}
          >
            {editing ? (
              <DurationField
                className="mb-0"
                hideErrorRow
                hideLabel
                label="Tiempo activo"
                onChange={setActiveText}
                placeholder="320 → 3:20"
                value={activeText}
              />
            ) : (
              displayDuration(feedback?.activeDurationMs)
            )}
          </DataField>

          <DataField
            editable={editable}
            editing={editing}
            id={`${fieldId}-distance`}
            label="Distancia (m)"
            onToggleEdit={() => setEditing((v) => !v)}
          >
            {editing ? (
              <InputField dense hideLabel keyboardType="number-pad" label="Distancia (metros)" onChange={setDistanceText} placeholder="Ej. 1200" value={distanceText} />
            ) : (
              feedback?.distanceMeters != null ? formatMeters(feedback.distanceMeters) : DASH
            )}
          </DataField>

          <DataField
            editable={editable}
            editing={editing}
            id={`${fieldId}-annotations`}
            label="Anotaciones"
            onToggleEdit={() => setEditing((v) => !v)}
          >
            {editing ? (
              <View className="gap-2" nativeID={`${fieldId}-annotations-editor`} testID={`${fieldId}-annotations-editor`}>
                <View className="max-h-40" nativeID={`${fieldId}-annotations-scroll-box`} testID={`${fieldId}-annotations-scroll-box`}>
                  <ScrollView nestedScrollEnabled nativeID={`${fieldId}-annotations-scroll`} testID={`${fieldId}-annotations-scroll`}>
                    <InputField dense hideLabel label="Anotaciones" multiline numberOfLines={4} onChange={setAnnotations} placeholder="Notas sobre esta serie…" value={annotations} />
                  </ScrollView>
                </View>
                <VoiceAnnotationControls onAppendText={setAnnotations} text={annotations} />
              </View>
            ) : feedback?.annotations ? (
              <ScrollView nestedScrollEnabled className="max-h-32" nativeID={`${fieldId}-annotations-readonly-scroll`} testID={`${fieldId}-annotations-readonly-scroll`}>
                <Text className="text-sm text-slate-800 dark:text-slate-100" nativeID={`${fieldId}-annotations-readonly-text`} testID={`${fieldId}-annotations-readonly-text`}>
                  {feedback.annotations}
                </Text>
              </ScrollView>
            ) : (
              DASH
            )}
          </DataField>
        </View>

        {feedback && (
          <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="session-review-detail-persisted" testID="session-review-detail-persisted">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-label" testID="session-review-detail-persisted-label">
              Metadatos
            </Text>
            <View className="gap-1.5" nativeID="session-review-detail-persisted-values" testID="session-review-detail-persisted-values">
              <View className="flex-row items-center justify-between" nativeID="session-review-detail-persisted-gps" testID="session-review-detail-persisted-gps">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-gps-label" testID="session-review-detail-persisted-gps-label">Puntos GPS</Text>
                <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100" nativeID="session-review-detail-persisted-gps-value" testID="session-review-detail-persisted-gps-value">
                  {feedback.pointsCount > 0 ? `${feedback.pointsCount} punto(s)` : 'Sin puntos'}
                </Text>
              </View>
              <View className="flex-row items-center justify-between" nativeID="session-review-detail-persisted-source" testID="session-review-detail-persisted-source">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-source-label" testID="session-review-detail-persisted-source-label">Origen</Text>
                <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100" nativeID="session-review-detail-persisted-source-value" testID="session-review-detail-persisted-source-value">
                  {feedback.reportSource ?? DASH}
                </Text>
              </View>
            </View>
          </View>
        )}

        {feedback && (
          <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="session-review-detail-trajectory-card" testID="session-review-detail-trajectory-card">
            <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="session-review-detail-trajectory-card-label" testID="session-review-detail-trajectory-card-label">
              Trayectoria
            </Text>
            <TrajectorySketch feedbackId={feedback.id} pointsCount={feedback.pointsCount} />
          </View>
        )}

        {editable && (
          <View className="gap-2" nativeID="session-review-detail-actions" testID="session-review-detail-actions">
            {error && (
              <Text className="text-xs text-red-500 dark:text-red-400" nativeID="session-review-detail-error" testID="session-review-detail-error">{error}</Text>
            )}

            <Pressable
              className={`h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80 ${saving || !editing ? 'opacity-50' : ''}`}
              disabled={saving || !editing}
              nativeID="session-review-detail-save-button"
              onPress={handleSave}
              testID="session-review-detail-save-button"
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons color={colors.onPrimary} name="content-save-outline" size={18} />
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="session-review-detail-save-label" testID="session-review-detail-save-label">
                    Guardar serie
                  </Text>
                </>
              )}
            </Pressable>

            {!editing && (
              <Text className="text-center text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-edit-hint" testID="session-review-detail-edit-hint">
                Tocá el ícono de lápiz para editar los valores.
              </Text>
            )}
          </View>
        )}
```

por:

```jsx
        <View className={isNarrowWeb ? 'gap-4' : 'flex-row gap-4'} nativeID="session-review-detail-columns" testID="session-review-detail-columns">
          <View className={isNarrowWeb ? '' : 'flex-1'} nativeID="session-review-detail-columns-data" testID="session-review-detail-columns-data">
            <View className="mb-4 gap-2.5" nativeID="session-review-detail-fields" testID="session-review-detail-fields">
              <DataField
                editable={editable}
                editing={editing}
                id={`${fieldId}-started`}
                label="Inicio (started_at)"
                onToggleEdit={() => setEditing((v) => !v)}
              >
                {editing ? (
                  <View className="gap-2" nativeID={`${fieldId}-started-editor`} testID={`${fieldId}-started-editor`}>
                    <DateField
                      disableFutureLimit
                      label="Fecha de inicio"
                      onChange={handleStartDateChange}
                      value={startedDate}
                    />
                    <TimeField
                      className="mb-0"
                      hideErrorRow
                      label="Hora de inicio"
                      onChange={handleStartTimeChange}
                      value={startedTime}
                    />
                  </View>
                ) : (
                  formatDayTime(feedback?.startedAt)
                )}
              </DataField>

              <DataField
                editable={editable}
                editing={editing}
                id={`${fieldId}-ended`}
                label="Fin (ended_at)"
                onToggleEdit={() => setEditing((v) => !v)}
              >
                {editing ? (
                  <View className="gap-2" nativeID={`${fieldId}-ended-editor`} testID={`${fieldId}-ended-editor`}>
                    <DateField
                      disableFutureLimit
                      label="Fecha de fin"
                      onChange={handleEndDateChange}
                      value={endedDate}
                    />
                    <TimeField
                      className="mb-0"
                      hideErrorRow
                      label="Hora de fin"
                      onChange={handleEndTimeChange}
                      value={endedTime}
                    />
                  </View>
                ) : (
                  formatDayTime(feedback?.endedAt)
                )}
              </DataField>

              <DataField
                editable={editable}
                editing={editing}
                hint={durationHint}
                id={`${fieldId}-duration`}
                label="Duración"
                onToggleEdit={() => setEditing((v) => !v)}
              >
                {editing ? (
                  <DurationField
                    className="mb-0"
                    hideErrorRow
                    hideLabel
                    label="Duración"
                    onChange={setDurationText}
                    placeholder="330 → 3:30"
                    value={durationText}
                  />
                ) : (
                  displayDuration(feedback?.durationMs)
                )}
              </DataField>

              <DataField
                editable={editable}
                editing={editing}
                id={`${fieldId}-active`}
                label="Tiempo activo (active_duration_ms)"
                onToggleEdit={() => setEditing((v) => !v)}
              >
                {editing ? (
                  <DurationField
                    className="mb-0"
                    hideErrorRow
                    hideLabel
                    label="Tiempo activo"
                    onChange={setActiveText}
                    placeholder="320 → 3:20"
                    value={activeText}
                  />
                ) : (
                  displayDuration(feedback?.activeDurationMs)
                )}
              </DataField>

              <DataField
                editable={editable}
                editing={editing}
                id={`${fieldId}-distance`}
                label="Distancia (m)"
                onToggleEdit={() => setEditing((v) => !v)}
              >
                {editing ? (
                  <InputField dense hideLabel keyboardType="number-pad" label="Distancia (metros)" onChange={setDistanceText} placeholder="Ej. 1200" value={distanceText} />
                ) : (
                  feedback?.distanceMeters != null ? formatMeters(feedback.distanceMeters) : DASH
                )}
              </DataField>

              <DataField
                editable={editable}
                editing={editing}
                id={`${fieldId}-annotations`}
                label="Anotaciones"
                onToggleEdit={() => setEditing((v) => !v)}
              >
                {editing ? (
                  <View className="gap-2" nativeID={`${fieldId}-annotations-editor`} testID={`${fieldId}-annotations-editor`}>
                    <View className="max-h-40" nativeID={`${fieldId}-annotations-scroll-box`} testID={`${fieldId}-annotations-scroll-box`}>
                      <ScrollView nestedScrollEnabled nativeID={`${fieldId}-annotations-scroll`} testID={`${fieldId}-annotations-scroll`}>
                        <InputField dense hideLabel label="Anotaciones" multiline numberOfLines={4} onChange={setAnnotations} placeholder="Notas sobre esta serie…" value={annotations} />
                      </ScrollView>
                    </View>
                    <VoiceAnnotationControls onAppendText={setAnnotations} text={annotations} />
                  </View>
                ) : feedback?.annotations ? (
                  <ScrollView nestedScrollEnabled className="max-h-32" nativeID={`${fieldId}-annotations-readonly-scroll`} testID={`${fieldId}-annotations-readonly-scroll`}>
                    <Text className="text-sm text-slate-800 dark:text-slate-100" nativeID={`${fieldId}-annotations-readonly-text`} testID={`${fieldId}-annotations-readonly-text`}>
                      {feedback.annotations}
                    </Text>
                  </ScrollView>
                ) : (
                  DASH
                )}
              </DataField>
            </View>

            {feedback && (
              <View className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="session-review-detail-persisted" testID="session-review-detail-persisted">
                <View className="mb-2 flex-row items-center gap-1.5" nativeID="session-review-detail-persisted-header" testID="session-review-detail-persisted-header">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="information-outline" size={14} />
                  <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-label" testID="session-review-detail-persisted-label">
                    Metadatos
                  </Text>
                </View>
                <View className="gap-1.5" nativeID="session-review-detail-persisted-values" testID="session-review-detail-persisted-values">
                  <View className="flex-row items-center justify-between" nativeID="session-review-detail-persisted-gps" testID="session-review-detail-persisted-gps">
                    <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-gps-label" testID="session-review-detail-persisted-gps-label">Puntos GPS</Text>
                    <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100" nativeID="session-review-detail-persisted-gps-value" testID="session-review-detail-persisted-gps-value">
                      {feedback.pointsCount > 0 ? `${feedback.pointsCount} punto(s)` : 'Sin puntos'}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between" nativeID="session-review-detail-persisted-source" testID="session-review-detail-persisted-source">
                    <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-source-label" testID="session-review-detail-persisted-source-label">Origen</Text>
                    <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100" nativeID="session-review-detail-persisted-source-value" testID="session-review-detail-persisted-source-value">
                      {feedback.reportSource ?? DASH}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {feedback && (
            <View className={isNarrowWeb ? 'mt-4' : 'flex-1'} nativeID="session-review-detail-columns-map" testID="session-review-detail-columns-map">
              <View className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="session-review-detail-trajectory-card" testID="session-review-detail-trajectory-card">
                <View className="flex-row items-center gap-1.5" nativeID="session-review-detail-trajectory-card-header" testID="session-review-detail-trajectory-card-header">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-path" size={14} />
                  <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="session-review-detail-trajectory-card-label" testID="session-review-detail-trajectory-card-label">
                    Trayectoria
                  </Text>
                </View>
                <Animated.View entering={FadeIn.duration(220)} nativeID="session-review-detail-trajectory-card-anim" testID="session-review-detail-trajectory-card-anim">
                  <SeriesTrajectoryMap feedbackId={feedback.id} pointsCount={feedback.pointsCount} />
                </Animated.View>
              </View>
            </View>
          )}
        </View>

        {editable && (
          <View className="mt-4 gap-2" nativeID="session-review-detail-actions" testID="session-review-detail-actions">
            {error && (
              <Text className="text-xs text-red-500 dark:text-red-400" nativeID="session-review-detail-error" testID="session-review-detail-error">{error}</Text>
            )}

            <Pressable
              className={`h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80 ${saving || !editing ? 'opacity-50' : ''}`}
              disabled={saving || !editing}
              nativeID="session-review-detail-save-button"
              onPress={handleSave}
              testID="session-review-detail-save-button"
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons color={colors.onPrimary} name="content-save-outline" size={18} />
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="session-review-detail-save-label" testID="session-review-detail-save-label">
                    Guardar serie
                  </Text>
                </>
              )}
            </Pressable>

            {!editing && (
              <Text className="text-center text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-edit-hint" testID="session-review-detail-edit-hint">
                Tocá el ícono de lápiz para editar los valores.
              </Text>
            )}
          </View>
        )}
```

(Cambios reales: el `View` nuevo `session-review-detail-columns` envolviendo datos+mapa en 2 columnas (`flex-row` en ancho, apilado en angosto vía `mt-4` en vez de `flex-1` en la columna del mapa); `TrajectorySketch` → `SeriesTrajectoryMap` adentro de un `Animated.View` con fade-in; ícono agregado a "Metadatos" y a "Trayectoria"; `{editable && (...)}` movido a sibling FUERA de las columnas, debajo de las dos, con `mt-4` en vez de ir pegado arriba. Los 6 `DataField` y la card de Metadatos quedan con el mismo contenido interno, solo re-anidados dentro de la columna de datos.)

- [ ] **Step 7: Verificar**

Run: `npm test && npm run lint`
Expected: sin fallos nuevos.

- [ ] **Step 8: Commit**

```bash
git add components/session-runtime/session-review-screen.jsx
git commit -m "feat(session-runtime): real map + desktop 2-column layout in session review detail"
```

---

### Task 3: Verificación manual + resiliencia de URL

**Files:** ninguno esperado (verificación; si aparece un bug real, arreglarlo y commitear aparte, mismo criterio que la verificación final del plan anterior de esta rama).

- [ ] **Step 1: Suite completa**

Run: `npm test && npm run lint`
Expected: 100% verde, 0 errores de lint.

- [ ] **Step 2: Estado vacío (sin GPS) -- alcanzable con mocks tal cual están hoy**

En preview web (mocks), entrar a una revisión de sesión (calendario → sesión del día → "Ir a entrenamiento"/"Registro de Sesión", o desde el menú de una fila en Historial), abrir el detalle de una serie sin GPS. Confirmar que se ve el aviso "Esta serie se registró sin GPS, no hay trayectoria para dibujar." -- mismo texto que ya mostraba `TrajectorySketch`, ahora servido por `SeriesTrajectoryMap`.

- [ ] **Step 3: Mapa con datos reales -- verificación aislada (los mocks no tienen GPS seedeado para sesiones normales)**

`services/__mocks__/workoutFeedback-mock.js` solo tiene puntos GPS seedeados para las 2 competencias de ruta (`feedbackId` 9000/9010, fuera del flujo de `session-review-screen.jsx`) — no hay ninguna sesión normal con GPS reservado en los mocks hoy, y sembrar una fila nueva tendría que apuntar a un `session_instance_id` generado dinámicamente por `calendar-mock.js` (contador `nextInstanceId`, no estable entre corridas) — no vale la pena construir esa infraestructura para esta verificación puntual.

En cambio, confirmar que `SeriesTrajectoryMap` dibuja bien datos reales llamando directo al service en la consola del preview (sin pasar por la pantalla real):

```js
// en preview_eval, con el bundle ya cargado:
await (await import('/services/runnerSession.js')).getWorkoutFeedbackPoints(9000)
```

Confirmar que devuelve los 5 puntos esperados (`services/__mocks__/workoutFeedback-mock.js`, feedback 9000). Si hace falta confirmar el RENDER real (no solo el fetch), se puede montar `SeriesTrajectoryMap` puntualmente pasándole `feedbackId={9000}`/`pointsCount={5}` en cualquier pantalla de prueba temporal, o aceptar la verificación ya hecha en un plan anterior de esta misma rama de que `LiveTrajectoryMap` dibuja bien un `referenceRoute`+`traveledPoints` reales (Task reviewado de `route-map-preview.jsx`/`live-trajectory-map.web.jsx`) — el único código nuevo acá es la MANERA en que se llega a esos props (síntesis de inicio/fin desde el primer/último punto), no el dibujo en sí.

- [ ] **Step 4: Layout desktop**

Con una serie CON feedback abierta (aunque sea sin GPS, la card de Metadatos ya alcanza para ver la columna de datos), redimensionar la ventana del preview entre angosto y ancho (`preview_resize`). Confirmar que en ancho los datos quedan de un lado y la card de Trayectoria (si `feedback` existe) del otro, y que en angosto todo vuelve a apilarse como antes.

- [ ] **Step 5: Resiliencia de URL -- probar de verdad, no solo confiar en el código**

Con una revisión abierta (`/training-session-review?...`), hacer un F5 real (`preview_eval` con `window.location.reload()`, o el navegador real). Confirmar que la pantalla no manda a home y reconstruye el slot desde los query params (`reviewSlotFromNavParams`). Si falla, es un bug real a arreglar en este mismo task -- no se espera que falle (el mecanismo ya existe y se usa), pero no se da por bueno sin esta prueba.

- [ ] **Step 6: Commit (solo si Step 2-5 encontraron algo para arreglar)**

Si todo pasó limpio, no hace falta ningún commit en este task.

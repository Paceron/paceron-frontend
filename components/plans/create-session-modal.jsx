import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
// ScrollView de gesture-handler, alias aparte — solo para el contenedor
// de ejercicios de la sesión en layout angosto (envuelve las
// ReorderableRow, cada una con su propio GestureDetector). Un ScrollView
// plano de 'react-native' no negocia bien con un GestureDetector anidado
// en nativo (bug real, mismo motivo documentado en
// session-exercise-panel.jsx) — el resto del archivo sigue con el
// ScrollView de 'react-native' de siempre, sin cambios.
import { GestureHandlerRootView, ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExercises } from '../../hooks/use-exercises.js';
import { useSessionMutations } from '../../hooks/use-sessions.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { InputField, FIELD_LABEL } from '../forms/fields.jsx';
import { SESSION_ROLE_ORDER, SESSION_ROLE_META, WARMCOOL_KINDS } from './exercise-kind-meta.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import {
  SessionDragProvider, useSessionDropTarget, useSessionAutoScrollTarget, SessionDropIndicator,
  ReorderProvider, ReorderableRow, ReorderDropIndicator, DragGhost, reorderList,
} from './session-drag-and-drop.jsx';
import { SessionExercisePanel } from './session-exercise-panel.jsx';
import { SessionExerciseRow, SessionFormBody } from './session-form-body.jsx';

// Cuerpo del modal en layout ancho — 2 columnas: datos de la sesión +
// catálogo de origen del arrastre a la izquierda (angosta), lista de
// ejercicios DE LA SESIÓN a la derecha ocupando todo el alto y la mayor
// parte del ancho — es la unidad de trabajo real, el catálogo es solo
// una fuente de la que arrastrar (ver enmienda 2026-09-13: antes las 3
// cosas de la izquierda competían por el mismo alto que el catálogo de
// la derecha, dejando lugar para apenas 2-3 filas visibles). El `View`
// de la lista de la sesión se registra como drop target vía
// useSessionDropTarget(). El alto de las 2 columnas sale de que el
// padre (`create-session-modal-body`) es `flex-1` dentro de una card de
// alto FIJO (`create-session-modal-card`, ver CreateSessionModal) — no
// de un alto propio en cada columna.
function SessionModalWideBody({ name, onSetName, description, onSetDescription, exercises, catalogExercises, onChangeExercise, onChangeRole, onReorder, onRemove, onExerciseDropped, error, visible }) {
  const dropTargetRef = useSessionDropTarget();
  const { autoScrollRef, onListScroll } = useSessionAutoScrollTarget();

  return (
    <View className="flex-1 flex-row gap-4" nativeID="create-session-modal-body" testID="create-session-modal-body">
      <View className="w-[320px] shrink-0" nativeID="create-session-modal-form-column" testID="create-session-modal-form-column">
        <InputField autoFocus={visible} dense hideErrorRow label="Nombre" onChange={onSetName} placeholder="Ej. Series de velocidad" value={name} />
        <InputField dense hideErrorRow label="Descripción (opcional)" onChange={onSetDescription} value={description} />

        <View className="flex-1" nativeID="create-session-modal-catalog-wrapper" testID="create-session-modal-catalog-wrapper">
          <SessionExercisePanel onExerciseAdded={onExerciseDropped} />
        </View>
      </View>

      <View className="flex-1" nativeID="create-session-modal-exercises-column" testID="create-session-modal-exercises-column">
        <Text className={FIELD_LABEL} nativeID="create-session-modal-exercises-header-label" testID="create-session-modal-exercises-header-label">Ejercicios</Text>
        <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID="create-session-modal-drop-hint" testID="create-session-modal-drop-hint">
          Arrastrá ejercicios del catálogo de la izquierda para agregarlos acá. Mantené presionada una fila para reordenarla.
        </Text>

        {/* flex-1: ocupa todo el alto que sobra en la columna, fijo por
            el alto fijo de la card — agregar ejercicios hace overflow
            con scroll propio en vez de estirar el modal. dropTargetRef
            mide este contenedor (no el ScrollView interno) para el
            cálculo de soltado. Sin showsVerticalScrollIndicator={false}:
            esa prop en RNW oculta el scrollbar del browser por completo
            (tiene sentido en mobile nativo, no en desktop, donde el
            usuario necesita ver que hay más contenido) — bug real,
            encontrado por el usuario, el área nunca mostraba scrollbar
            pese a desbordar. El estilo del scrollbar (fino, temático)
            ya lo define global.css para cualquier elemento con scroll,
            así que no hace falta nada más acá.
            Reordenamiento por mantener-presionado (ReorderableRow, ver
            session-drag-and-drop.jsx) desde 2026-09-14, unificado con
            mobile/narrow — antes esta columna usaba botones arriba/abajo
            (que a su vez habían reemplazado a react-native-drax,
            evaluado y descartado el mismo día por incompatibilidad con
            gesture-handler v2, ver CLAUDE.md). */}
        <View className="flex-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-600" nativeID="create-session-modal-exercises-list" ref={dropTargetRef} testID="create-session-modal-exercises-list">
          <ReorderProvider>
            <GestureScrollView
              contentContainerClassName="gap-2 p-2"
              nativeID="create-session-modal-exercises-scroll"
              onScroll={onListScroll}
              ref={autoScrollRef}
              scrollEventThrottle={16}
              testID="create-session-modal-exercises-scroll"
            >
              {exercises.length === 0 ? (
                <Text className="p-2 text-xs text-slate-400 dark:text-slate-500" nativeID="create-session-modal-exercises-empty" testID="create-session-modal-exercises-empty">
                  Todavía no agregaste ejercicios.
                </Text>
              ) : exercises.map((entry, index) => (
                <ReorderableRow index={index} itemCount={exercises.length} key={entry.localKey} onReorder={onReorder} scrollViewRef={autoScrollRef}>
                  <SessionExerciseRow
                    catalogExercises={catalogExercises}
                    entry={entry}
                    idPrefix={`create-session-modal-exercise-row-${entry.localKey}`}
                    index={index}
                    onChangeExercise={onChangeExercise}
                    onChangeRole={onChangeRole}
                    onRemove={onRemove}
                  />
                </ReorderableRow>
              ))}
            </GestureScrollView>
            <SessionDropIndicator />
            <ReorderDropIndicator />
          </ReorderProvider>
        </View>

        {error && (
          <Text className="mb-3 mt-2 text-xs text-red-500 dark:text-red-400" nativeID="create-session-modal-error" testID="create-session-modal-error">{error}</Text>
        )}
      </View>
    </View>
  );
}

// Alta rápida de una sesión nueva desde adentro de armar un día de
// entrenamiento en un plan — mismo motivo que CreateExerciseModal: un
// modal, no una pantalla nueva, para no perder el plan a medio armar.
// Con la prop opcional `session` (ver docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md)
// dobla como edición, mismo criterio que CreateExerciseModal. Una sesión
// ya no son 3 bloques fijos — es una lista libre de ejercicios, cada uno
// con su propio rol (ver enmienda 2026-09-05 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md); igual se
// pide al menos 1 ejercicio de cada rol al guardar.
export function CreateSessionModal({ visible, onClose, onCreated, session }) {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { exercises: catalogExercises } = useExercises(userId);
  const { createSession, updateSession } = useSessionMutations();
  const isEditing = Boolean(session);
  const isNarrowWeb = useIsNarrowWeb();
  const isWideLayout = isWeb && !isNarrowWeb;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const draftSeq = useRef(0);

  const makeBlankRow = (role) => ({
    localKey: `session-exercise-draft-${Date.now()}-${draftSeq.current++}`,
    exerciseId: '',
    role,
    repeatCount: 1,
    restMinutes: 0,
  });

  const resetKey = `${visible}-${session?.id ?? 'new'}`;
  const prevResetKeyRef = useRef(null);
  const isResetting = visible && resetKey !== prevResetKeyRef.current;

  // Precarga (o limpia) el formulario cada vez que el modal se abre —
  // mismo criterio que CreateExerciseModal. Se ajusta de forma síncrona
  // durante el render (no en un useEffect) para que useFormDirty, más
  // abajo, pueda usar los valores del registro que se está editando en
  // el mismo render donde cambia el resetKey. Los setState de acá no se
  // reflejan en `name`/`description`/`exercises` hasta el próximo render
  // (React no muta el valor en el render en curso), así que dirtyValues
  // no puede leerlos directo — usa los valores "efectivos" post-reset
  // (`resetValues`) mientras `isResetting` es true, y `useFormDirty`
  // recibe ese objeto como snapshot base en el mismo render donde
  // resetKey cambia. Sin este ajuste, useFormDirty capturaría el
  // baseline un render antes de tiempo, con los valores viejos/vacíos
  // todavía en los states, y marcaría dirty=true de entrada al reabrir
  // en modo edición (falso positivo).
  const resetValues = {
    name: session?.name ?? '',
    description: session?.description ?? '',
    // El panel de ejercicios adjunto (catálogo, arrastrable) reemplaza al
    // "arranque con filas en blanco" en las dos plataformas por igual
    // desde 2026-09-14 — el usuario arrastra lo que necesita, arrancar
    // vacío deja el alto fijo del área de ejercicios (ver más abajo)
    // consistente desde el primer render.
    exercises: session?.exercises?.length ? session.exercises.map((e) => ({ ...e })) : [],
  };

  if (isResetting) {
    prevResetKeyRef.current = resetKey;
    setName(resetValues.name);
    setDescription(resetValues.description);
    setExercises(resetValues.exercises);
    setError(null);
  } else if (!visible) {
    prevResetKeyRef.current = null;
  }

  const dirtyValues = isResetting ? resetValues : { name, description, exercises };
  const formDirty = useFormDirty(dirtyValues, session?.id ?? 'new');
  const isDirty = visible && formDirty;
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  const handleClose = () => {
    if (submitting) return;
    guardedClose(onClose);
  };

  const handleChangeExercise = (localKey, patch) => {
    setExercises((rows) => rows.map((r) => (r.localKey === localKey ? { ...r, ...patch } : r)));
  };

  // Si la fila pasa a un rol restringido (calor/calma) y el ejercicio ya
  // elegido no es de los kinds permitidos ahí, se limpia la selección —
  // evita que "Series 400m fuertes" quede como vuelta a la calma.
  const handleChangeRole = (localKey, role) => {
    setExercises((rows) => rows.map((r) => {
      if (r.localKey !== localKey) return r;
      if (role !== 'main' && r.exerciseId) {
        const chosen = catalogExercises.find((e) => e.id === r.exerciseId);
        if (chosen && !WARMCOOL_KINDS.includes(chosen.kind)) return { ...r, role, exerciseId: '' };
      }
      return { ...r, role };
    }));
  };

  const handleRemoveExercise = (localKey) => setExercises((rows) => rows.filter((r) => r.localKey !== localKey));

  // Reordenamiento por mantener-presionado-y-arrastrar (ReorderableRow),
  // unificado en ambos layouts desde 2026-09-14 — recibe directamente
  // los índices de origen/destino.
  const handleReorderExercises = (fromIndex, toIndex) => {
    setExercises((rows) => reorderList(rows, fromIndex, toIndex));
  };

  // Inserta un ejercicio nuevo arrastrado desde el catálogo (cross-
  // container) en la posición estimada — compartido por los dos
  // layouts, ver onExerciseDropped en SessionModalWideBody/NarrowBody.
  const handleExerciseDropped = (exercise, insertIndex) => setExercises((rows) => {
    const next = [...rows];
    next.splice(Math.min(insertIndex, next.length), 0, { ...makeBlankRow('main'), exerciseId: exercise.id });
    return next;
  });

  const handleSubmit = async () => {
    if (submitting) return;
    if (!name.trim() || exercises.length === 0) {
      setError('Completá el nombre y agregá al menos un ejercicio de cada tipo (entrada en calor, principal, vuelta a la calma).');
      return;
    }
    if (exercises.some((e) => !e.exerciseId)) {
      setError('Completá o quitá los ejercicios sin seleccionar.');
      return;
    }
    const missingRoles = SESSION_ROLE_ORDER.filter((role) => !exercises.some((e) => e.role === role));
    if (missingRoles.length > 0) {
      setError(`Falta al menos un ejercicio de: ${missingRoles.map((r) => SESSION_ROLE_META[r].label).join(', ')}.`);
      return;
    }
    setSubmitting(true);
    const form = {
      ownerId: userId,
      name: name.trim(),
      description: description.trim(),
      exercises,
    };
    const result = isEditing
      ? await updateSession({ ownerId: userId, sessionId: session.id, form })
      : await createSession({ ownerId: userId, form });
    setSubmitting(false);

    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: `No pudimos ${isEditing ? 'guardar' : 'crear'} la sesión`, text2: result.error });
      return;
    }

    notifySuccess();
    Toast.show({ type: 'success', text1: isEditing ? 'Sesión actualizada' : 'Sesión creada' });
    onCreated(result.session);
  };

  return (
    <>
      <Modal animationType="fade" nativeID="create-session-modal" onRequestClose={handleClose} testID="create-session-modal" transparent visible={visible}>
        {/* GestureHandlerRootView propio acá adentro: react-native Modal
            monta su contenido en una superficie nativa SEPARADA (fuera
            del árbol de vistas de la app) — el GestureHandlerRootView de
            app/_layout.jsx, que envuelve toda la app, no llega hasta acá
            en nativo (documentado en gesture-handler: todo Modal con
            gestos necesita su propio root). Sin esto, cualquier gesto
            adentro del modal queda mudo en nativo sin ningún error
            (bug real reportado en Expo Go: ni el scroll ni el
            hold-and-drag respondían) — en web nunca se notó porque el
            Modal de react-native-web es solo una View con estilos, no
            una superficie nativa aparte.
            SessionDragProvider (+ DragGhost hermano, no anidado) sube
            acá, envolviendo TODO el contenido del modal — antes solo
            envolvía SessionModalWideBody (layout ancho, web-only), donde
            `position: 'fixed'` del ghost ignora la jerarquía de todos
            modos. Ahora que el layout angosto (incluye mobile nativo)
            también arrastra, `position: 'absolute'` SÍ depende de dónde
            se monta: como hijo directo del host de pantalla completa que
            `Modal` arma, ancla contra la pantalla real — anidado más
            adentro (dentro del padding/centrado de la tarjeta) quedaría
            offseteado del cursor real, mismo bug ya documentado y
            corregido para web pero ahora en nativo. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
        <SessionDragProvider>
          <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="create-session-modal-backdrop" onPress={handleClose} testID="create-session-modal-backdrop">
            <Pressable className={`max-h-[94%] w-full ${isWideLayout ? 'h-[640px] max-w-5xl' : 'h-[94%] max-w-lg'} rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface`} nativeID="create-session-modal-card" onPress={() => {}} testID="create-session-modal-card">
              <View className="mb-4 flex-row items-center gap-2" nativeID="create-session-modal-header" testID="create-session-modal-header">
                <MaterialCommunityIcons color={colors.primary} name={isEditing ? 'pencil-outline' : 'clipboard-plus-outline'} size={20} />
                <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="create-session-modal-title" testID="create-session-modal-title">
                  {isEditing ? 'Editar sesión' : 'Nueva sesión'}
                </Text>
              </View>

              {isWideLayout ? (
                <SessionModalWideBody
                  catalogExercises={catalogExercises}
                  description={description}
                  error={error}
                  exercises={exercises}
                  onChangeExercise={handleChangeExercise}
                  onChangeRole={handleChangeRole}
                  onExerciseDropped={handleExerciseDropped}
                  onRemove={handleRemoveExercise}
                  onReorder={handleReorderExercises}
                  onSetDescription={setDescription}
                  onSetName={setName}
                  name={name}
                  visible={visible}
                />
              ) : (
                /* flex-1 (no solo max-h en el card ancestro): sin esto, un
                   ScrollView dentro de un contenedor column con altura
                   máxima no se ve obligado a ceder al tamaño disponible —
                   toma el alto de su contenido igual, y el resto de la
                   tarjeta termina recortado sin poder scrollear, sobre todo
                   notorio en mobile nativo con teclado/contenido largo.
                   Esto solo, sin embargo, no alcanza: el card ancestro
                   (create-session-modal-card, rama angosta) necesita además
                   una altura EXPLÍCITA (h-[94%], no solo max-h-[94%]) —
                   bug real encontrado 2026-09-14 en Expo Go: max-height sin
                   height deja el card con tamaño intrínseco (a su
                   contenido) en Yoga nativo, así que este ScrollView
                   flex-1 no tenía a qué alto crecer y colapsaba a 0 (modal
                   se veía en blanco, solo título y botones, sin error en
                   consola). Web tolera ese mismo layout sin colapsar por
                   diferencias del algoritmo flexbox del browser vs Yoga —
                   por eso nunca se notó ahí. Mismo criterio que el fix ya
                   aplicado a la rama ancha (h-[640px] junto a max-h-[94%]). */
                <SessionFormBody
                  catalogExercises={catalogExercises}
                  description={description}
                  error={error}
                  exercises={exercises}
                  onChangeExercise={handleChangeExercise}
                  onChangeRole={handleChangeRole}
                  onExerciseDropped={handleExerciseDropped}
                  onRemove={handleRemoveExercise}
                  onReorder={handleReorderExercises}
                  onSetDescription={setDescription}
                  onSetName={setName}
                  name={name}
                  visible={visible}
                />
              )}

            <View className="mt-2 flex-row gap-3" nativeID="create-session-modal-actions" testID="create-session-modal-actions">
              <Pressable
                className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                disabled={submitting}
                nativeID="create-session-modal-cancel-button"
                onPress={handleClose}
                testID="create-session-modal-cancel-button"
              >
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="create-session-modal-cancel-label" testID="create-session-modal-cancel-label">Cancelar</Text>
              </Pressable>
              <Pressable
                className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80"
                disabled={submitting}
                nativeID="create-session-modal-confirm-button"
                onPress={handleSubmit}
                testID="create-session-modal-confirm-button"
              >
                {submitting ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-session-modal-confirm-label" testID="create-session-modal-confirm-label">
                    {isEditing ? 'Guardar cambios' : 'Crear'}
                  </Text>
                )}
              </Pressable>
            </View>
            </Pressable>
          </Pressable>
          <DragGhost />
        </SessionDragProvider>
        </GestureHandlerRootView>
      </Modal>

      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}

import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { SESSION_ROLE_ORDER, SESSION_ROLE_META } from './exercise-kind-meta.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import {
  SessionDragProvider, useSessionDropTarget, useSessionAutoScrollTarget, SessionDropIndicator,
  ReorderProvider, ReorderableRow, ReorderDropIndicator, DragGhost, reorderList,
} from './session-drag-and-drop.jsx';
import { SessionExercisePanel } from './session-exercise-panel.jsx';

const WARMCOOL_KINDS = ['walking', 'jogging', 'elongation'];

// Selector de rol de un ejercicio dentro de la sesión — solo-ícono (sin
// label visible, accessibilityLabel por segmento) para que, junto al
// select de ejercicio y el botón de quitar, una fila entera quepa en una
// sola línea incluso en mobile. El contenedor fuerza h-12 explícito en
// vez de dejar que el padding lo determine solo — a diferencia de
// DaySegmentedPicker (training-plan-form-fields.jsx), que nunca tuvo un
// vecino de altura fija al lado y por eso nadie notó que su alto
// orgánico no daba justo 48px. Acá sí importa (pedido explícito: selector
// de rol "a la misma altura" que el resto de los campos).
function SessionRoleSegmentedPicker({ idPrefix, value, onChange }) {
  return (
    <View
      accessibilityLabel="Rol del ejercicio"
      accessibilityRole="radiogroup"
      className="h-12 flex-row items-center gap-1 self-start rounded-full bg-slate-100 px-1 dark:bg-slate-800"
      nativeID={`${idPrefix}-role-pill`}
      testID={`${idPrefix}-role-pill`}
    >
      {SESSION_ROLE_ORDER.map((role) => {
        const meta = SESSION_ROLE_META[role];
        const active = value === role;
        const segId = `${idPrefix}-role-${role}`;
        return (
          <Pressable
            accessibilityLabel={meta.label}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            className={`h-9 w-9 items-center justify-center rounded-full ${active ? meta.bg : 'hover:bg-slate-200/60 dark:hover:bg-slate-700/60'}`}
            key={role}
            nativeID={segId}
            onPress={() => onChange(role)}
            testID={segId}
          >
            <MaterialCommunityIcons color={active ? meta.iconColor : '#94a3b8'} name={meta.icon} size={18} />
          </Pressable>
        );
      })}
    </View>
  );
}

// Selector de rol cerrado — mismo dato que SessionRoleSegmentedPicker
// (icono siempre visible) pero para variante `compact` (mobile/narrow):
// en vez de mostrar los 3 iconos en fila, muestra solo el activo; el
// menú de verdad (AnimatedDropdown) NO se monta acá adentro — se monta
// UNA sola vez arriba, en CreateSessionModal (ver roleMenu ahí). Este
// componente solo es el botón disparador: mide su propia posición
// MENOS la del contenedor de referencia (mismo patrón que
// ExerciseMenuButton en exercises-catalog-tab.jsx — measureInWindow da
// coordenadas de PANTALLA, pero el menú se posiciona relativo al
// contenedor, no a la pantalla) y reporta esas coordenadas relativas
// hacia arriba vía onOpenMenu.
// Bug real corregido 2026-09-14: antes este componente montaba su
// propio AnimatedDropdown, anidado varios niveles adentro de una fila
// con transform (ReorderableRow) dentro de un Modal — measureInWindow
// SÍ daba coordenadas de pantalla correctas (confirmado con
// console.log, el tap y la medición andaban bien), pero se las pasaba
// directo como top/left al panel, que en RN Web se posiciona relativo
// al ancestro posicionado más cercano (nunca la pantalla real cuando
// está tan anidado) — el menú terminaba renderizado fuera de la vista
// visible o detrás de otro contenido. Ganancia de espacio para el
// nombre queda igual — costo sigue siendo el mismo (abrir + elegir en
// vez de 1 tap directo).
function SessionRoleClosedSelect({ idPrefix, value, containerRef, onOpenMenu }) {
  const buttonRef = useRef(null);
  const meta = SESSION_ROLE_META[value];

  const handleOpen = () => {
    if (!containerRef?.current || !buttonRef.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      buttonRef.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu({ top: y - containerY + height + 4, left: x - containerX });
      });
    });
  };

  return (
    <Pressable
      accessibilityLabel={`Rol: ${meta.label}`}
      className={`h-12 w-12 items-center justify-center rounded-full ${meta.bg}`}
      nativeID={`${idPrefix}-role-select`}
      onPress={handleOpen}
      ref={buttonRef}
      testID={`${idPrefix}-role-select`}
    >
      <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={18} />
    </Pressable>
  );
}

// Pill inline chico (ícono + input numérico + sufijo) — reemplaza al
// InputField con label propio que usaban repeticiones/descanso: ese
// combo (label + input h-12) agregaba una fila entera de alto aparte del
// toggle "Serie repetida" cuando estaba activo. Acá los dos viven en la
// MISMA fila que el toggle (ver series-row más abajo), sin fila extra.
function CompactNumberPill({ idPrefix, icon, suffix, value, onChange, accessibilityLabel }) {
  return (
    <View className="h-8 flex-row items-center gap-1 rounded-full bg-slate-100 px-2 dark:bg-slate-800" nativeID={idPrefix} testID={idPrefix}>
      <MaterialCommunityIcons color="#94a3b8" name={icon} size={14} />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        className="w-6 text-xs text-slate-900 outline-none dark:text-white"
        keyboardType="number-pad"
        nativeID={`${idPrefix}-input`}
        onChangeText={onChange}
        testID={`${idPrefix}-input`}
        value={value}
      />
      <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-suffix`} testID={`${idPrefix}-suffix`}>{suffix}</Text>
    </View>
  );
}

// Una fila = un ejercicio de la sesión. Rol (pill solo-ícono) + select de
// ejercicio + botón de quitar en una sola línea, siempre a la misma
// altura (h-12 los 3); "Serie repetida" es un toggle chico aparte —
// colapsado por default para que la fila no crezca salvo que haga falta,
// mismo criterio ya usado para los días de un plan.
// El reordenamiento es SIEMPRE por mantener-presionado-y-arrastrar sobre
// la fila entera (ReorderableRow, en ambos layouts desde 2026-09-14) —
// ya no hay botones subir/bajar. `compact` (mobile/narrow) sigue
// controlando solo el selector de rol: cerrado (1 ícono + menú) en vez
// del segmentado de 3 íconos, para ganar ancho para el nombre del
// ejercicio — en desktop sobra espacio, se mantiene el segmentado.
function SessionExerciseRow({ idPrefix, entry, index, catalogExercises, onChangeExercise, onChangeRole, onRemove, compact, roleMenuContainerRef, onOpenRoleMenu }) {
  const [isSeries, setIsSeries] = useState(entry.repeatCount > 1);
  const roleOptions = entry.role === 'main' ? catalogExercises : catalogExercises.filter((e) => WARMCOOL_KINDS.includes(e.kind));

  const handleToggleSeries = () => {
    const next = !isSeries;
    setIsSeries(next);
    if (!next) onChangeExercise(entry.localKey, { repeatCount: 1, restMinutes: 0 });
  };

  return (
    <View className="gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-fields`} testID={`${idPrefix}-fields`}>
        {compact ? (
          <SessionRoleClosedSelect containerRef={roleMenuContainerRef} idPrefix={idPrefix} onOpenMenu={(anchor) => onOpenRoleMenu(entry.localKey, anchor)} value={entry.role} />
        ) : (
          <SessionRoleSegmentedPicker idPrefix={idPrefix} onChange={(role) => onChangeRole(entry.localKey, role)} value={entry.role} />
        )}
        <View className="flex-1" nativeID={`${idPrefix}-select-wrapper`} testID={`${idPrefix}-select-wrapper`}>
          <ResponsiveSelectField
            className="mb-0"
            dense
            hideErrorRow
            hideLabel
            label={`Ejercicio ${index + 1}`}
            onChange={(exerciseId) => onChangeExercise(entry.localKey, { exerciseId })}
            options={roleOptions.map((e) => ({ id: e.id, name: e.name }))}
            placeholder={roleOptions.length ? 'Elegí un ejercicio' : 'Todavía no hay ejercicios de este tipo'}
            required
            value={entry.exerciseId}
          />
        </View>
        <Pressable
          accessibilityLabel="Quitar ejercicio"
          className="h-12 w-12 items-center justify-center rounded-xl border border-slate-200 hover:bg-red-50 active:opacity-70 dark:border-slate-700 dark:hover:bg-red-900/20"
          nativeID={`${idPrefix}-remove-button`}
          onPress={() => onRemove(entry.localKey)}
          testID={`${idPrefix}-remove-button`}
        >
          <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={18} />
        </Pressable>
      </View>

      <View className="flex-row flex-wrap items-center gap-2" nativeID={`${idPrefix}-series-row`} testID={`${idPrefix}-series-row`}>
        <Pressable
          accessibilityLabel="Marcar como serie repetida"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSeries }}
          className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
          nativeID={`${idPrefix}-series-toggle`}
          onPress={handleToggleSeries}
          testID={`${idPrefix}-series-toggle`}
        >
          <MaterialCommunityIcons color={isSeries ? '#8cc63e' : '#94a3b8'} name="repeat-variant" size={16} />
          <Text className={`text-xs font-semibold ${isSeries ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`} nativeID={`${idPrefix}-series-toggle-label`} testID={`${idPrefix}-series-toggle-label`}>
            Serie repetida
          </Text>
        </Pressable>

        {isSeries && (
          <>
            <CompactNumberPill
              accessibilityLabel="Repeticiones"
              icon="repeat-variant"
              idPrefix={`${idPrefix}-repeat-count`}
              onChange={(v) => onChangeExercise(entry.localKey, { repeatCount: Number(v) || 1 })}
              suffix="×"
              value={String(entry.repeatCount)}
            />
            <CompactNumberPill
              accessibilityLabel="Descanso en minutos"
              icon="timer-outline"
              idPrefix={`${idPrefix}-rest-minutes`}
              onChange={(v) => onChangeExercise(entry.localKey, { restMinutes: Number(v) || 0 })}
              suffix="min"
              value={String(entry.restMinutes)}
            />
          </>
        )}
      </View>
    </View>
  );
}

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
                <ReorderableRow index={index} itemCount={exercises.length} key={entry.localKey} onReorder={onReorder}>
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

// Cuerpo del modal en layout angosto (mobile nativo + web angosto) —
// todo apilado en una sola columna con scroll vertical: nombre,
// descripción, catálogo de ejercicios como tira horizontal (arrastrable
// con hold), y la lista de ejercicios DE LA SESIÓN con alto fijo y
// scroll propio (mismo criterio que la columna derecha del layout
// ancho — ver SessionModalWideBody). Reemplaza al antiguo botón
// "Agregar ejercicio" + filas pre-cargadas por rol (2026-09-14): ahora
// arranca vacío y se carga por drag, igual que el layout ancho.
function SessionModalNarrowBody({ name, onSetName, description, onSetDescription, exercises, catalogExercises, onChangeExercise, onChangeRole, onRemove, onReorder, onExerciseDropped, error, visible, roleMenuContainerRef, onOpenRoleMenu }) {
  const dropTargetRef = useSessionDropTarget();
  const { autoScrollRef, onListScroll } = useSessionAutoScrollTarget();

  return (
    <ScrollView className="flex-1" nativeID="create-session-modal-scroll" showsVerticalScrollIndicator={false} testID="create-session-modal-scroll">
      <InputField autoFocus={!isWeb && visible} dense hideErrorRow label="Nombre" onChange={onSetName} placeholder="Ej. Series de velocidad" value={name} />
      <InputField dense hideErrorRow label="Descripción (opcional)" onChange={onSetDescription} value={description} />

      <SessionExercisePanel horizontal onExerciseAdded={onExerciseDropped} />

      <Text className={`${FIELD_LABEL} mb-1 mt-3`} nativeID="create-session-modal-exercises-header-label" testID="create-session-modal-exercises-header-label">Ejercicios</Text>
      <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID="create-session-modal-drop-hint" testID="create-session-modal-drop-hint">
        Mantené presionado un ejercicio del catálogo para sumarlo, o una fila para reordenarla.
      </Text>

      <View className="h-[320px] rounded-xl border border-dashed border-slate-300 dark:border-slate-600" nativeID="create-session-modal-exercises-list" ref={dropTargetRef} testID="create-session-modal-exercises-list">
        <ReorderProvider>
          <GestureScrollView
            contentContainerClassName="gap-2 p-2 pb-4"
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
              <ReorderableRow index={index} itemCount={exercises.length} key={entry.localKey} onReorder={onReorder}>
                <SessionExerciseRow
                  catalogExercises={catalogExercises}
                  compact
                  entry={entry}
                  idPrefix={`create-session-modal-exercise-row-${entry.localKey}`}
                  index={index}
                  onChangeExercise={onChangeExercise}
                  onChangeRole={onChangeRole}
                  onOpenRoleMenu={onOpenRoleMenu}
                  onRemove={onRemove}
                  roleMenuContainerRef={roleMenuContainerRef}
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
    </ScrollView>
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

  // Menú de rol (mobile/narrow) montado UNA sola vez acá, no por fila —
  // ver SessionRoleClosedSelect para el porqué (measureInWindow da
  // coordenadas de pantalla, pero el panel se posiciona relativo al
  // ancestro más cercano — cardRef es ese ancestro de referencia, tanto
  // para las filas que reportan su posición como para este mismo menú).
  const cardRef = useRef(null);
  const [roleMenu, setRoleMenu] = useState(null);
  const roleMenuEntry = roleMenu ? exercises.find((e) => e.localKey === roleMenu.localKey) : null;

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
            <Pressable className={`max-h-[94%] w-full ${isWideLayout ? 'h-[640px] max-w-5xl' : 'h-[94%] max-w-lg'} rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface`} nativeID="create-session-modal-card" onPress={() => {}} ref={cardRef} style={{ position: 'relative' }} testID="create-session-modal-card">
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
                <SessionModalNarrowBody
                  catalogExercises={catalogExercises}
                  description={description}
                  error={error}
                  exercises={exercises}
                  onChangeExercise={handleChangeExercise}
                  onChangeRole={handleChangeRole}
                  onExerciseDropped={handleExerciseDropped}
                  onOpenRoleMenu={(localKey, anchor) => setRoleMenu({ localKey, anchor })}
                  onRemove={handleRemoveExercise}
                  onReorder={handleReorderExercises}
                  onSetDescription={setDescription}
                  onSetName={setName}
                  name={name}
                  roleMenuContainerRef={cardRef}
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

            {/* Montado UNA sola vez acá (no por fila) — ver
                SessionRoleClosedSelect para el porqué. cardRef es el
                mismo ancestro de referencia que cada fila usa para
                reportar su posición relativa. */}
            <AnimatedDropdown
              anchorStyle={roleMenu ? { top: roleMenu.anchor.top, left: roleMenu.anchor.left } : {}}
              onClose={() => setRoleMenu(null)}
              open={Boolean(roleMenu)}
            >
              {roleMenuEntry && (
                <View className="w-48 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-surface" nativeID="create-session-modal-role-menu" testID="create-session-modal-role-menu">
                  {SESSION_ROLE_ORDER.map((role) => {
                    const roleMeta = SESSION_ROLE_META[role];
                    const optId = `create-session-modal-role-menu-option-${role}`;
                    return (
                      <Pressable
                        className="flex-row items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
                        key={role}
                        nativeID={optId}
                        onPress={() => { handleChangeRole(roleMenuEntry.localKey, role); setRoleMenu(null); }}
                        testID={optId}
                      >
                        <MaterialCommunityIcons color={roleMeta.iconColor} name={roleMeta.icon} size={16} />
                        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`${optId}-label`} testID={`${optId}-label`}>{roleMeta.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </AnimatedDropdown>
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

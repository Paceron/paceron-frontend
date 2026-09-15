import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
// ScrollView de gesture-handler (no el de 'react-native' plano) — en
// nativo, un ScrollView plano no negocia correctamente con un
// GestureDetector anidado adentro (acá, las DraggableExerciseCard con
// holdMs): sin esto, el scroll horizontal de la tira quedaba
// completamente bloqueado apenas se tocaba una card, incluso sin llegar
// a activarse el drag (bug real reportado en Expo Go, 2026-09-14). Este
// ScrollView es API-compatible con el de 'react-native' (mismo props),
// así que reemplaza sin cambios en el resto del archivo.
import { ScrollView } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExercises } from '../../hooks/use-exercises.js';
import { FIELD_LABEL } from '../forms/fields.jsx';
import { EXERCISE_KIND_META, buildExerciseStatLine } from './exercise-kind-meta.js';
import { CreateExerciseModal } from './create-exercise-modal.jsx';
import { DraggableExerciseCard } from './session-drag-and-drop.jsx';

// Mini-catálogo embebido en el modal de sesión (columna derecha, solo
// web ancho) — mismo criterio visual que exercises-catalog-tab.jsx,
// sin acciones de editar/eliminar (esto no es el catálogo real, es un
// selector para arrastrar a la sesión).
function PanelExerciseCard({ exercise }) {
  const meta = EXERCISE_KIND_META[exercise.kind] ?? EXERCISE_KIND_META.walking;
  const statLine = buildExerciseStatLine(exercise);
  const idPrefix = `session-exercise-panel-card-${exercise.id}`;

  return (
    <View className="mb-2 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <View className={`h-8 w-8 items-center justify-center rounded-full ${meta.bg}`} nativeID={`${idPrefix}-icon`} testID={`${idPrefix}-icon`}>
        <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={16} />
      </View>
      <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
          {exercise.name}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-stat`} numberOfLines={1} testID={`${idPrefix}-stat`}>
          {statLine || meta.label}
        </Text>
      </View>
    </View>
  );
}

// Variante compacta (icono + nombre, sin stat) para la tira horizontal
// de mobile/narrow — rectángulo ancho fijo (más ancho que alto, para el
// nombre) y alto fijo (h-20, no solo w-*): sin alto fijo, el texto a 1 o
// 2 líneas hacía que cada card tuviera una altura distinta según el
// nombre del ejercicio (bug real reportado, todas debían quedar
// parejas) — justify-center además centra el contenido cuando el
// nombre entra en 1 sola línea.
function PanelExerciseCardCompact({ exercise }) {
  const meta = EXERCISE_KIND_META[exercise.kind] ?? EXERCISE_KIND_META.walking;
  const idPrefix = `session-exercise-panel-card-compact-${exercise.id}`;

  return (
    <View className="h-20 w-28 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <View className={`h-8 w-8 items-center justify-center rounded-full ${meta.bg}`} nativeID={`${idPrefix}-icon`} testID={`${idPrefix}-icon`}>
        <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={16} />
      </View>
      <Text className="text-center text-[11px] font-medium text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={2} testID={`${idPrefix}-name`}>
        {exercise.name}
      </Text>
    </View>
  );
}

// horizontal (mobile/narrow): tira con scroll horizontal en vez de lista
// vertical con buscador — el buscador se saca acá a propósito (poco
// ancho disponible, no alcanza para agregar otro control más sin
// apretar todo); si hace falta buscar, el catálogo completo sigue
// existiendo en la pestaña Ejercicios. El botón "Crear ejercicio" (antes
// un link de texto arriba de la lista de ejercicios de la sesión, ver
// CreateSessionModal) se muda acá, mismo ícono "+" que ya usa la
// variante ancha.
export function SessionExercisePanel({ onExerciseAdded, horizontal = false }) {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { exercises } = useExercises(userId);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const query = search.trim().toLowerCase();
  const filtered = query ? exercises.filter((e) => e.name.toLowerCase().includes(query)) : exercises;

  if (horizontal) {
    return (
      <View nativeID="session-exercise-panel" testID="session-exercise-panel">
        <View className="mb-2 flex-row items-center justify-between" nativeID="session-exercise-panel-header" testID="session-exercise-panel-header">
          <Text className={FIELD_LABEL} nativeID="session-exercise-panel-header-label" testID="session-exercise-panel-header-label">Catálogo de ejercicios</Text>
          <Pressable
            accessibilityLabel="Crear ejercicio"
            className="rounded-full p-1.5 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
            nativeID="session-exercise-panel-create-button"
            onPress={() => setShowCreateModal(true)}
            testID="session-exercise-panel-create-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="plus" size={20} />
          </Pressable>
        </View>

        {exercises.length === 0 ? (
          <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="session-exercise-panel-empty" testID="session-exercise-panel-empty">
            Todavía no creaste ningún ejercicio.
          </Text>
        ) : (
          <ScrollView
            contentContainerClassName="gap-2 pb-1"
            horizontal
            nativeID="session-exercise-panel-list"
            showsHorizontalScrollIndicator={false}
            testID="session-exercise-panel-list"
          >
            {exercises.map((exercise) => (
              // holdMs: la tira scrollea horizontal, el drag hacia la
              // lista de ejercicios de la sesión es vertical — sin el
              // delay, cualquier intento de scrollear la tira se
              // interpretaría como el inicio de un arrastre. Subido de
              // 300 a 450ms (2026-09-14, mismo motivo que en
              // ReorderableRow): con 300ms, un scroll LENTO deliberado
              // podía tardar más en cruzar el umbral de failOffsetX que
              // en llegar al hold, activándose como drag en vez de ceder
              // al ScrollView (bug real: solo un swipe agresivo
              // scrolleaba).
              <DraggableExerciseCard exercise={exercise} holdMs={450} key={exercise.id} onDropped={onExerciseAdded}>
                <PanelExerciseCardCompact exercise={exercise} />
              </DraggableExerciseCard>
            ))}
          </ScrollView>
        )}

        <CreateExerciseModal onClose={() => setShowCreateModal(false)} onCreated={() => setShowCreateModal(false)} visible={showCreateModal} />
      </View>
    );
  }

  return (
    <View className="flex-1" nativeID="session-exercise-panel" testID="session-exercise-panel">
      <View className="mb-2 flex-row items-center justify-between" nativeID="session-exercise-panel-header" testID="session-exercise-panel-header">
        <Text className={FIELD_LABEL} nativeID="session-exercise-panel-header-label" testID="session-exercise-panel-header-label">Catálogo de ejercicios</Text>
        <Pressable
          accessibilityLabel="Crear ejercicio"
          className="rounded-full p-1.5 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID="session-exercise-panel-create-button"
          onPress={() => setShowCreateModal(true)}
          testID="session-exercise-panel-create-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="plus" size={20} />
        </Pressable>
      </View>

      <View className="mb-3 h-10 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900" nativeID="session-exercise-panel-search-row" testID="session-exercise-panel-search-row">
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={16} />
        <TextInput
          className="flex-1 text-sm text-slate-900 outline-none dark:text-white"
          nativeID="session-exercise-panel-search-input"
          onChangeText={setSearch}
          placeholder="Buscar ejercicio"
          placeholderTextColor={colors.onSurfaceVariant}
          testID="session-exercise-panel-search-input"
          value={search}
        />
      </View>

      <ScrollView nativeID="session-exercise-panel-list" testID="session-exercise-panel-list">
        {filtered.length === 0 ? (
          <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="session-exercise-panel-empty" testID="session-exercise-panel-empty">
            Ningún ejercicio coincide.
          </Text>
        ) : (
          filtered.map((exercise) => (
            <DraggableExerciseCard exercise={exercise} key={exercise.id} onDropped={onExerciseAdded}>
              <PanelExerciseCard exercise={exercise} />
            </DraggableExerciseCard>
          ))
        )}
      </ScrollView>

      <CreateExerciseModal onClose={() => setShowCreateModal(false)} onCreated={() => setShowCreateModal(false)} visible={showCreateModal} />
    </View>
  );
}

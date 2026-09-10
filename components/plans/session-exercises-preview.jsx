import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { useExercises } from '../../hooks/use-exercises.js';
import { EXERCISE_KIND_META, SESSION_ROLE_ORDER } from './exercise-kind-meta.js';

// Preview de lo que trae una sesión (lista libre de ejercicios, cada uno
// con su rol — ver enmienda 2026-09-05 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md) — chips de
// color por tipo de ejercicio, reusado por el picker de sesión al armar
// un día de plan (training-plan-form-fields.jsx) y por el catálogo de
// sesiones (sessions-catalog-tab.jsx). Resuelve los ejercicios contra
// useExercises, así que asume que ya están cargados (el caller ya montó
// el hook con el mismo ownerId). Se agrupa por rol (calor, principal, calma)
// para una lectura consistente sin importar el orden de carga/edición.
export function SessionExercisesPreview({ session }) {
  const userId = useAuthStore((s) => s.userId);
  const { exercises } = useExercises(userId);
  if (!session) return null;

  const idPrefix = `session-preview-${session.id}`;
  const ordered = SESSION_ROLE_ORDER.flatMap((role) => session.exercises.filter((e) => e.role === role));

  return (
    <View className="mt-2 flex-row flex-wrap gap-1.5" nativeID={idPrefix} testID={idPrefix}>
      {ordered.map((entry, i) => {
        const exercise = exercises.find((e) => e.id === entry.exerciseId);
        if (!exercise) return null;
        const meta = EXERCISE_KIND_META[exercise.kind];
        const label = entry.repeatCount > 1 ? `${entry.repeatCount}× ${exercise.name}` : exercise.name;
        return (
          <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${meta.bg}`} key={entry.localKey} nativeID={`${idPrefix}-${i}`} testID={`${idPrefix}-${i}`}>
            <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={12} />
            <Text className={`text-xs font-medium ${meta.text}`} nativeID={`${idPrefix}-${i}-label`} testID={`${idPrefix}-${i}-label`}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

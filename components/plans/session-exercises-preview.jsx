import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useExerciseStore } from '../../store/exercise-store.js';
import { EXERCISE_KIND_META } from './exercise-kind-meta.js';

// Preview de lo que trae una sesión (warmup/main/cooldown, con sus
// íconos por tipo) — chips de color, reusado por el picker de sesión al
// armar un día de plan (training-plan-form-fields.jsx) y por el
// catálogo de sesiones (sessions-catalog-tab.jsx). Resuelve los
// ejercicios contra useExerciseStore, así que asume que ya están
// cargados (fetchExercises corrido por el caller).
export function SessionExercisesPreview({ session }) {
  const exercises = useExerciseStore((s) => s.exercises);
  if (!session) return null;

  const warmup = exercises.find((e) => e.id === session.warmupExerciseId);
  const main = exercises.find((e) => e.id === session.mainExerciseId);
  const cooldown = exercises.find((e) => e.id === session.cooldownExerciseId);
  const idPrefix = `session-preview-${session.id}`;

  return (
    <View className="mt-2 flex-row flex-wrap gap-1.5" nativeID={idPrefix} testID={idPrefix}>
      {[warmup, main, cooldown].filter(Boolean).map((exercise, i) => {
        const meta = EXERCISE_KIND_META[exercise.kind];
        const label = exercise === main && session.mainRepeatCount > 1 ? `${session.mainRepeatCount}× ${exercise.name}` : exercise.name;
        return (
          <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${meta.bg}`} key={`${idPrefix}-${i}`} nativeID={`${idPrefix}-${i}`} testID={`${idPrefix}-${i}`}>
            <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={12} />
            <Text className={`text-xs font-medium ${meta.text}`} nativeID={`${idPrefix}-${i}-label`} testID={`${idPrefix}-${i}-label`}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

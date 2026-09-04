import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { dayLabel } from '../../store/training-plan-store.js';
import { useTodayPlanSession } from '../../hooks/use-today-plan-session.js';
import { EXERCISE_KIND_META, DAY_KIND_META, buildExerciseStatLine } from './exercise-kind-meta.js';

// Copy corto por tipo de día cuando hoy NO es de entrenamiento — un plan
// marcado como actual sigue apareciendo en el hero aunque hoy le toque
// descanso, no desaparece (ver spec).
const REST_DAY_COPY = {
  rest: 'Día de descanso — dejá que el cuerpo recupere.',
  other: 'Hoy toca algo distinto al plan de carrera.',
};

// Fila de ejercicio "hero" — misma personalidad que ExerciseRow de
// training-plan-detail-screen.jsx (ícono de color por tipo) pero más
// grande, protagonista de la card en vez de una fila más en una lista.
function HeroExerciseRow({ idPrefix, roleLabel, exercise, repeatCount = 1, restMinutes = 0 }) {
  if (!exercise) return null;
  const meta = EXERCISE_KIND_META[exercise.kind] ?? EXERCISE_KIND_META.walking;
  const statLine = buildExerciseStatLine(exercise, { repeatCount, restMinutes });

  return (
    <View className="flex-row items-center gap-3" nativeID={idPrefix} testID={idPrefix}>
      <View className={`h-12 w-12 items-center justify-center rounded-2xl ${meta.bg}`} nativeID={`${idPrefix}-icon`} testID={`${idPrefix}-icon`}>
        <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={24} />
      </View>
      <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-role`} testID={`${idPrefix}-role`}>
          {roleLabel}
        </Text>
        <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`}>
          {repeatCount > 1 ? `${repeatCount} × ` : ''}{exercise.name}
        </Text>
        {statLine && (
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-stat`} testID={`${idPrefix}-stat`}>
            {statLine}
          </Text>
        )}
      </View>
    </View>
  );
}

// Card protagonista del hero de "Mis planes" — un plan marcado como
// "actual" (ver spec 2026-09-03) con la sesión de HOY resuelta. Header
// con color/ícono del tipo de día (DAY_KIND_META), cuerpo con los 3
// ejercicios "estilo gimnasio" si hoy toca entrenamiento, o un estado
// temático simple si es descanso/otra actividad.
export function TodaySessionCard({ plan }) {
  const router = useRouter();
  const colors = useThemeColors();
  const { loading, day, session, warmupExercise, mainExercise, cooldownExercise } = useTodayPlanSession(plan);
  const idPrefix = `today-session-card-${plan.id}`;

  const dayMeta = DAY_KIND_META[day?.kind ?? 'rest'] ?? DAY_KIND_META.rest;
  const isTraining = day?.kind === 'training';
  const hasSession = isTraining && Boolean(session);

  return (
    <View className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <View className={`flex-row items-center justify-between px-5 py-4 ${dayMeta.bg}`} nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <View className="flex-1 pr-3" nativeID={`${idPrefix}-header-text`} testID={`${idPrefix}-header-text`}>
          <Text className={`text-[11px] font-bold uppercase tracking-widest ${dayMeta.text}`} nativeID={`${idPrefix}-today-label`} testID={`${idPrefix}-today-label`}>
            Hoy · {dayLabel(day?.dayOfWeek)}
          </Text>
          <Text
            className="text-lg text-slate-900 dark:text-white"
            nativeID={`${idPrefix}-plan-name`}
            numberOfLines={1}
            style={{ fontFamily: 'Orbitron_700Bold' }}
            testID={`${idPrefix}-plan-name`}
          >
            {plan.name}
          </Text>
        </View>
        <View className="h-12 w-12 items-center justify-center rounded-full bg-white/60 dark:bg-black/20" nativeID={`${idPrefix}-header-icon`} testID={`${idPrefix}-header-icon`}>
          <MaterialCommunityIcons color={dayMeta.iconColor} name={dayMeta.icon} size={26} />
        </View>
      </View>

      <View className="gap-3 p-5" nativeID={`${idPrefix}-body`} testID={`${idPrefix}-body`}>
        {loading ? (
          <View className="items-center py-6" nativeID={`${idPrefix}-loading`} testID={`${idPrefix}-loading`}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : hasSession ? (
          <>
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-session-name`} testID={`${idPrefix}-session-name`}>
              {session.name}
            </Text>
            <HeroExerciseRow exercise={warmupExercise} idPrefix={`${idPrefix}-warmup`} roleLabel="Entrada en calor" />
            <HeroExerciseRow
              exercise={mainExercise}
              idPrefix={`${idPrefix}-main`}
              repeatCount={session.mainRepeatCount}
              restMinutes={session.mainRestMinutes}
              roleLabel="Principal"
            />
            <HeroExerciseRow exercise={cooldownExercise} idPrefix={`${idPrefix}-cooldown`} roleLabel="Vuelta a la calma" />
          </>
        ) : (
          <View className="items-center gap-2 py-6" nativeID={`${idPrefix}-no-session`} testID={`${idPrefix}-no-session`}>
            <MaterialCommunityIcons color={dayMeta.iconColor} name={dayMeta.icon} size={40} />
            <Text className="text-base font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-no-session-title`} testID={`${idPrefix}-no-session-title`}>
              {day?.kind === 'other' ? day.otherName : dayMeta.label}
            </Text>
            <Text className="text-center text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-no-session-copy`} testID={`${idPrefix}-no-session-copy`}>
              {REST_DAY_COPY[day?.kind] ?? REST_DAY_COPY.rest}
            </Text>
          </View>
        )}

        <Pressable
          className="mt-1 h-11 flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80"
          nativeID={`${idPrefix}-view-plan-button`}
          onPress={() => router.push(`/plans/${plan.id}`)}
          testID={`${idPrefix}-view-plan-button`}
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-view-plan-label`} testID={`${idPrefix}-view-plan-label`}>
            Ver plan completo
          </Text>
          <MaterialCommunityIcons color="#111518" name="arrow-right" size={16} />
        </Pressable>
      </View>
    </View>
  );
}

import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';

const MUTED_ICON = '#94a3b8';
const MUTED_TEXT = 'text-slate-500 dark:text-slate-400';

function tierLabel(tier) {
  return tier === 'premium' ? 'Premium' : 'Base';
}

// Control de dos segmentos, reusado en Profile, el dropdown web y el
// drawer mobile. Cada segmento muestra ícono+label y, como segunda línea,
// el tier del rol (si está activado). Corredor a la izquierda (rol base,
// siempre disponible). Entrenador a la derecha: si no está activado
// todavía se ve apagado con label "Activar" y, al tocarlo, navega a la
// pantalla de activación — por eso dropdown/sidebar solo deben montar
// este componente cuando el entrenador YA está activado (mismo gate que
// tenían antes con el pill viejo), para no reintroducir la activación
// fuera de Profile.
export function RoleSwitchToggle({ onClose }) {
  const router = useRouter();
  const activeRole = useAuthStore((s) => s.activeRole);
  const roles = useAuthStore((s) => s.roles);
  const switchRole = useAuthStore((s) => s.switchRole);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');

  const runnerActive = activeRole === 'runner';
  const trainerActive = activeRole === 'trainer';
  const runnerTier = roles.find((r) => r.name === 'corredor')?.tier;
  const trainerTier = roles.find((r) => r.name === 'entrenador')?.tier;

  const handlePressRunner = () => {
    if (!runnerActive) switchRole();
    onClose?.();
  };

  const handlePressTrainer = () => {
    if (!hasTrainerRole) {
      onClose?.();
      router.push('/profile/activate-trainer');
      return;
    }
    if (!trainerActive) switchRole();
    onClose?.();
  };

  return (
    <View className="flex-row rounded-full bg-slate-100 p-1 dark:bg-slate-800">
      <Pressable
        accessibilityLabel="Corredor"
        accessibilityRole="button"
        accessibilityState={{ selected: runnerActive }}
        className={`items-center rounded-full px-4 py-1.5 ${runnerActive ? 'bg-primary-tint dark:bg-primary/15' : ''}`}
        onPress={handlePressRunner}
      >
        <View className="flex-row items-center gap-1.5">
          <MaterialCommunityIcons color={runnerActive ? '#8cc63e' : MUTED_ICON} name="run-fast" size={16} />
          <Text className={`text-xs font-semibold ${runnerActive ? 'text-on-primary-tint dark:text-primary' : MUTED_TEXT}`}>
            Corredor
          </Text>
        </View>
        <Text
          className={`text-[9px] font-medium uppercase tracking-wide ${
            runnerActive ? 'text-on-primary-tint/80 dark:text-primary/80' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {tierLabel(runnerTier)}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel={hasTrainerRole ? 'Entrenador' : 'Activar perfil de entrenador'}
        accessibilityRole="button"
        accessibilityState={{ selected: trainerActive }}
        className={`items-center rounded-full px-4 py-1.5 ${trainerActive ? 'bg-amber-500/15' : ''}`}
        onPress={handlePressTrainer}
      >
        <View className="flex-row items-center gap-1.5">
          <MaterialCommunityIcons color={trainerActive ? '#f59e0b' : MUTED_ICON} name="whistle" size={16} />
          <Text className={`text-xs font-semibold ${trainerActive ? 'text-amber-600 dark:text-amber-400' : MUTED_TEXT}`}>
            {hasTrainerRole ? 'Entrenador' : 'Activar'}
          </Text>
        </View>
        {hasTrainerRole && (
          <Text
            className={`text-[9px] font-medium uppercase tracking-wide ${
              trainerActive ? 'text-amber-600/80 dark:text-amber-400/80' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {tierLabel(trainerTier)}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

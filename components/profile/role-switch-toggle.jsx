import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';
import { RoleBadge } from '../shell/role-badge.jsx';

const MUTED_ICON = '#94a3b8';
const MUTED_TEXT = 'text-slate-500 dark:text-slate-400';

function tierLabel(tier) {
  return tier === 'premium' ? 'Premium' : 'Base';
}

// Un segmento del switch. En modo compacto (dropdown/sidebar) el tier va
// en una segunda línea debajo del ícono+label; en modo wide (Profile, con
// todo el ancho disponible) va inline en la misma línea, separado por "·".
function Segment({ wide, active, activeBg, activeIconColor, activeTextClass, icon, label, tier, onPress, accessibilityLabel }) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`items-center rounded-full px-3 py-1.5 ${wide ? 'flex-1' : ''} ${active ? activeBg : ''}`}
      onPress={onPress}
    >
      <View className="flex-row items-center gap-1.5">
        <MaterialCommunityIcons color={active ? activeIconColor : MUTED_ICON} name={icon} size={16} />
        <Text className={`text-xs font-semibold ${active ? activeTextClass : MUTED_TEXT}`}>{label}</Text>
        {wide && tier != null && (
          <Text className={`text-[10px] font-medium uppercase tracking-wide opacity-70 ${active ? activeTextClass : 'text-slate-400 dark:text-slate-500'}`}>
            · {tier}
          </Text>
        )}
      </View>
      {!wide && tier != null && (
        <Text className={`text-[9px] font-medium uppercase tracking-wide ${active ? activeTextClass : 'text-slate-400 dark:text-slate-500'}`}>
          {tier}
        </Text>
      )}
    </Pressable>
  );
}

// Reusado en Profile, el dropdown web y el drawer mobile.
// - Sin perfil de entrenador: pill de Corredor (siempre activo, rol base) +
//   botón "Volverse Entrenador" que navega a la pantalla de activación.
//   No hay switch en este caso (nada entre lo cual alternar todavía).
// - Con perfil de entrenador: switch real de dos segmentos, cada uno con
//   su tier. `wide` estira el switch a todo el ancho disponible (Profile);
//   sin `wide`, mantiene su ancho intrínseco (dropdown/sidebar).
// Dropdown/sidebar solo montan este componente cuando el entrenador YA
// está activado (mismo gate que el pill viejo), para no reintroducir la
// activación fuera de Profile.
export function RoleSwitchToggle({ onClose, wide = false }) {
  const router = useRouter();
  const activeRole = useAuthStore((s) => s.activeRole);
  const roles = useAuthStore((s) => s.roles);
  const switchRole = useAuthStore((s) => s.switchRole);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');

  const handleActivate = () => {
    onClose?.();
    router.push('/profile/activate-trainer');
  };

  if (!hasTrainerRole) {
    return (
      <View className={`flex-row items-center gap-3 ${wide ? 'w-full justify-between' : ''}`}>
        <RoleBadge active role="runner" size="md" />
        <Pressable
          accessibilityLabel="Volverse Entrenador"
          accessibilityRole="button"
          className="flex-row items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 active:opacity-70"
          onPress={handleActivate}
        >
          <MaterialCommunityIcons color="#f59e0b" name="whistle" size={16} />
          <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">Volverse Entrenador</Text>
        </Pressable>
      </View>
    );
  }

  const runnerActive = activeRole === 'runner';
  const trainerActive = activeRole === 'trainer';
  const runnerTier = roles.find((r) => r.name === 'corredor')?.tier;
  const trainerTier = roles.find((r) => r.name === 'entrenador')?.tier;

  const handlePressRunner = () => {
    if (!runnerActive) switchRole();
    onClose?.();
  };

  const handlePressTrainer = () => {
    if (!trainerActive) switchRole();
    onClose?.();
  };

  return (
    <View className={`flex-row rounded-full bg-slate-100 p-1 dark:bg-slate-800 ${wide ? 'w-full' : ''}`}>
      <Segment
        accessibilityLabel="Corredor"
        active={runnerActive}
        activeBg="bg-primary-tint dark:bg-primary/15"
        activeIconColor="#8cc63e"
        activeTextClass="text-on-primary-tint dark:text-primary"
        icon="run-fast"
        label="Corredor"
        onPress={handlePressRunner}
        tier={tierLabel(runnerTier)}
        wide={wide}
      />
      <Segment
        accessibilityLabel="Entrenador"
        active={trainerActive}
        activeBg="bg-amber-500/15"
        activeIconColor="#f59e0b"
        activeTextClass="text-amber-600 dark:text-amber-400"
        icon="whistle"
        label="Entrenador"
        onPress={handlePressTrainer}
        tier={tierLabel(trainerTier)}
        wide={wide}
      />
    </View>
  );
}

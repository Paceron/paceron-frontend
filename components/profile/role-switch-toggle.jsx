import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';
import { usePermissions } from '../../hooks/use-user.js';
import { formatTierName } from '../../utils/tier-name.js';

const MUTED_ICON = '#94a3b8';
const MUTED_TEXT = 'text-slate-500 dark:text-slate-400';

// Etiqueta corta del tier para el segmento del switch. `roles[].tier` trae
// el nombre resuelto del tier (ej. "premium_entrenador", "base_entrenador",
// "base") — se toma la parte antes del sufijo de rol y se capitaliza. Antes
// se comparaba `tier === 'premium'` contra el nombre completo y nunca
// matcheaba, así que siempre daba "BASE" aunque se hubiera pagado.
// null cuando no hay dato = no dibuja la línea de tier en el segmento.
function tierLabel(tierName) {
  return formatTierName(tierName) || null;
}

// El texto ya no indica el rol — la pantalla de destino muestra los
// tiers del rol activo, no hace falta anticiparlo en el link (antes
// "Mejorar tier de {roleLabel}", una entrada de menú por rol).
function TierUpgradeLink({ onPress, className }) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`hover:opacity-70 active:opacity-70 ${className ?? ''}`}
      nativeID="role-switch-toggle-tier-upgrade-link"
      onPress={onPress}
      testID="role-switch-toggle-tier-upgrade-link"
    >
      <Text className="text-[11px] font-semibold text-primary" nativeID="role-switch-toggle-tier-upgrade-link-text" testID="role-switch-toggle-tier-upgrade-link-text">Mejorar tier</Text>
    </Pressable>
  );
}

// Un segmento del switch. En modo compacto (dropdown/sidebar) el tier va
// en una segunda línea debajo del ícono+label; en modo wide (Profile, con
// todo el ancho disponible) va inline en la misma línea, separado por "·".
function Segment({ id, wide, active, activeBg, activeIconColor, activeTextClass, icon, label, tier, onPress, accessibilityLabel }) {
  // `hover:`/`active:`/`focus:` y `shadow-*` tienen que estar SIEMPRE
  // presentes o SIEMPRE ausentes entre los dos estados de un mismo
  // componente, nunca aparecer solo en uno -- ver CLAUDE.md "Quirks
  // conocidos" y el mismo patrón ya resuelto en payments-amount-mode.jsx.
  // El hover queda fijo en las dos ramas acá abajo.
  //
  // Esto NO alcanzó solo: el bug seguía pasando al cambiar de rol (no en
  // la primera carga). Causa real: `transition-all` ya estaba sin
  // condición, pero la rama inactiva no declaraba NINGÚN color de fondo
  // (ninguna clase `bg-*`) -- al pasar a activa, la transición nativa de
  // `backgroundColor` tiene que interpolar desde "sin declarar" hasta el
  // color real, y en nativo (CSS transitions vía New Architecture) esa
  // interpolación queda pegada en el extremo vacío (transparente, sin
  // fondo ni borde) en vez de terminar en el color -- coincide con que la
  // PRIMERA carga nunca se rompe (ahí no hay transición, el estilo final
  // se aplica directo al montar). Fix: declarar fondo explícito en las dos
  // ramas (`bg-transparent` en la inactiva) para que siempre haya un
  // color de origen y de destino, y sacar `transition-all` -- no vale la
  // pena mantener una transición nativa todavía inestable para esto.
  const colorClasses = active ? `${activeBg} border-transparent` : 'bg-transparent border-slate-300 dark:border-slate-600';
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`items-center rounded-full border px-3 hover:bg-slate-300 dark:hover:bg-slate-600 hover:animate-pulse ${wide ? 'flex-1 py-4' : 'py-1.5'} ${colorClasses}`}
      nativeID={id}
      onPress={onPress}
      testID={id}
    >
      <View className="flex-row items-center gap-1.5" nativeID={`${id}-content`} testID={`${id}-content`}>
        <MaterialCommunityIcons color={active ? activeIconColor : MUTED_ICON} name={icon} size={16} />
        <Text className={`text-xs font-semibold ${active ? activeTextClass : MUTED_TEXT}`} nativeID={`${id}-label`} testID={`${id}-label`}>{label}</Text>
        {wide && tier != null && (
          <Text className={`text-[10px] font-medium uppercase tracking-wide opacity-70 ${active ? activeTextClass : 'text-slate-400 dark:text-slate-500'}`} nativeID={`${id}-tier-inline`} testID={`${id}-tier-inline`}>
            · {tier}
          </Text>
        )}
      </View>
      {!wide && tier != null && (
        <Text className={`text-[9px] font-medium uppercase tracking-wide ${active ? activeTextClass : 'text-slate-400 dark:text-slate-500'}`} nativeID={`${id}-tier-stacked`} testID={`${id}-tier-stacked`}>
          {tier}
        </Text>
      )}
    </Pressable>
  );
}

// Reusado en Profile, el dropdown web y el drawer mobile.
// - Sin perfil de entrenador: usa el mismo `Segment` que el switch real de
//   abajo, dentro del mismo contenedor (`role-switch-toggle-segments`,
//   mismo id/fondo) para que las dos lean como una sola estructura — antes
//   eran dos pills sueltas una al lado de la otra. Corredor va `active`
//   (coloreado, es el único rol real hoy — clickearlo no hace nada, igual
//   que clickear el segmento ya activo del switch real). "Volverse
//   Entrenador" va `active={false}` (mismo gris apagado que un segmento no
//   seleccionado) porque no es un rol activo, es un CTA — coloreado en
//   amber leía como si ya estuviera "activo" igual que Corredor.
// - Con perfil de entrenador: switch real de dos segmentos, cada uno con
//   su tier. `wide` estira el switch a todo el ancho disponible (Profile);
//   sin `wide`, mantiene su ancho intrínseco (dropdown/sidebar).
// Dropdown/sidebar solo montan este componente cuando el entrenador YA
// está activado (mismo gate que el pill viejo), para no reintroducir la
// activación fuera de Profile.
export function RoleSwitchToggle({ onClose, onUpgradeTier, wide = false, showTierLink = wide }) {
  const router = useRouter();
  const activeRole = useAuthStore((s) => s.activeRole);
  const userId = useAuthStore((s) => s.userId);
  const { roles } = usePermissions(userId);
  const switchRole = useAuthStore((s) => s.switchRole);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
  // Se calcula acá arriba (no solo en la rama con entrenador) porque el
  // segmento de Corredor lo necesita en los dos casos — sin esto, el tier
  // no se mostraba nunca hasta que se activaba el perfil de entrenador.
  const runnerTier = roles.find((r) => r.name === 'corredor')?.tier;

  const handleActivate = () => {
    onClose?.();
    router.push('/profile/activate-trainer');
  };

  if (!hasTrainerRole) {
    return (
      <View className={wide ? 'w-full items-center' : ''} nativeID="role-switch-toggle" testID="role-switch-toggle">
        <View className={`flex-row items-center rounded-full bg-slate-200/60 p-1 dark:bg-slate-700/50 ${wide ? 'w-full' : ''}`} nativeID="role-switch-toggle-segments" testID="role-switch-toggle-segments">
          <Segment
            accessibilityLabel="Corredor"
            active
            activeBg="bg-primary-tint dark:bg-primary/15"
            activeIconColor="#8cc63e"
            activeTextClass="text-on-primary-tint dark:text-primary"
            icon="run-fast"
            id="role-switch-toggle-runner-badge"
            label="Corredor"
            onPress={() => {}}
            tier={tierLabel(runnerTier)}
            wide={wide}
          />
          <Segment
            accessibilityLabel="Volverse Entrenador"
            active={false}
            icon="whistle"
            id="role-switch-toggle-activate-trainer-button"
            label="Volverse Entrenador"
            onPress={handleActivate}
            wide={wide}
          />
        </View>
        {showTierLink && <TierUpgradeLink className="mt-2" onPress={onUpgradeTier} />}
      </View>
    );
  }

  const runnerActive = activeRole === 'runner';
  const trainerActive = activeRole === 'trainer';
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
    <View className={wide ? 'w-full items-center' : ''} nativeID="role-switch-toggle" testID="role-switch-toggle">
      <View className={`flex-row rounded-full bg-slate-200/60 p-1 dark:bg-slate-700/50 ${wide ? 'w-full' : ''}`} nativeID="role-switch-toggle-segments" testID="role-switch-toggle-segments">
        <Segment
          accessibilityLabel="Corredor"
          active={runnerActive}
          activeBg="bg-primary-tint dark:bg-primary/15"
          activeIconColor="#8cc63e"
          activeTextClass="text-on-primary-tint dark:text-primary"
          icon="run-fast"
          id="role-switch-toggle-runner-segment"
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
          id="role-switch-toggle-trainer-segment"
          label="Entrenador"
          onPress={handlePressTrainer}
          tier={tierLabel(trainerTier)}
          wide={wide}
        />
      </View>
      {showTierLink && <TierUpgradeLink className="mt-2" onPress={onUpgradeTier} />}
    </View>
  );
}

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
  //
  // `hover:animate-pulse` sacado (2026-11-09, bug real reportado): en
  // touch -- incluido el toggle de device de Chrome DevTools, que es como
  // se reprodujo -- un tap deja el `:hover` de CSS pegado (no hay
  // `mouseleave` en touch), así que el segmento recién tocado queda
  // pulsando para siempre con el fondo YA correcto por debajo. Pasaba
  // solo en el switch de Profile porque ahí el botón sigue en pantalla
  // después del click; en la sidebar/dropdown el `onClose?.()` del
  // `onPress` cierra el panel al toque, así que el `:hover` pegado queda
  // oculto. `hover:bg-slate-300`/`dark:hover:bg-slate-600` se mantienen --
  // un fondo que queda pegado no se nota tanto como una animación en loop.
  const colorClasses = active ? `${activeBg} border-transparent` : 'bg-transparent border-slate-300 dark:border-slate-600';
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`items-center rounded-full border px-3 hover:bg-slate-300 dark:hover:bg-slate-600 ${wide ? 'flex-1 py-4' : 'py-1.5'} ${colorClasses}`}
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
//
// `idPrefix` (default el de siempre, `role-switch-toggle`) -- el drawer
// mobile/narrow web queda montado fuera de pantalla para la animación de
// apertura incluso con el menú cerrado, así que su instancia convive en el
// DOM con la de la página (ej. /profile) al mismo tiempo. Sin prefijo
// propio por caller, las dos compartían nativeID/testID -- bug real
// reportado 2026-11-09 (`role-switch-toggle-runner-segment` duplicado,
// confirmado con `document.querySelectorAll`). Cada shell que lo monta en
// un drawer pasa el suyo; Profile usa el default.
//
// Ya NO ofrece acceso a "Mejorar tier" (sacado 2026-11-10): quedaba
// duplicado contra el botón de la misma función en TrainerDataSection
// (profile-screen.jsx, dentro de "Configuración de Membresía"), que es el
// único lugar que lo muestra ahora.
export function RoleSwitchToggle({ onClose, wide = false, idPrefix = 'role-switch-toggle' }) {
  const router = useRouter();
  const activeRole = useAuthStore((s) => s.activeRole);
  const userId = useAuthStore((s) => s.userId);
  const { roles } = usePermissions(userId);
  const switchRole = useAuthStore((s) => s.switchRole);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');

  const handleActivate = () => {
    onClose?.();
    router.push('/profile/activate-trainer');
  };

  if (!hasTrainerRole) {
    return (
      <View className={wide ? 'w-full items-center' : ''} nativeID={idPrefix} testID={idPrefix}>
        <View className={`flex-row items-center rounded-full bg-slate-200/60 p-1 dark:bg-slate-700/50 ${wide ? 'w-full' : ''}`} nativeID={`${idPrefix}-segments`} testID={`${idPrefix}-segments`}>
          <Segment
            accessibilityLabel="Corredor"
            active
            activeBg="bg-primary-tint dark:bg-primary/15"
            activeIconColor="#8cc63e"
            activeTextClass="text-on-primary-tint dark:text-primary"
            icon="run-fast"
            id={`${idPrefix}-runner-badge`}
            label="Corredor"
            onPress={() => {}}
            wide={wide}
          />
          <Segment
            accessibilityLabel="Volverse Entrenador"
            active={false}
            icon="whistle"
            id={`${idPrefix}-activate-trainer-button`}
            label="Volverse Entrenador"
            onPress={handleActivate}
            wide={wide}
          />
        </View>
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
    <View className={wide ? 'w-full items-center' : ''} nativeID={idPrefix} testID={idPrefix}>
      <View className={`flex-row rounded-full bg-slate-200/60 p-1 dark:bg-slate-700/50 ${wide ? 'w-full' : ''}`} nativeID={`${idPrefix}-segments`} testID={`${idPrefix}-segments`}>
        <Segment
          accessibilityLabel="Corredor"
          active={runnerActive}
          activeBg="bg-primary-tint dark:bg-primary/15"
          activeIconColor="#8cc63e"
          activeTextClass="text-on-primary-tint dark:text-primary"
          icon="run-fast"
          id={`${idPrefix}-runner-segment`}
          label="Corredor"
          onPress={handlePressRunner}
          wide={wide}
        />
        <Segment
          accessibilityLabel="Entrenador"
          active={trainerActive}
          activeBg="bg-amber-500/15"
          activeIconColor="#f59e0b"
          activeTextClass="text-amber-600 dark:text-amber-400"
          icon="whistle"
          id={`${idPrefix}-trainer-segment`}
          label="Entrenador"
          onPress={handlePressTrainer}
          tier={tierLabel(trainerTier)}
          wide={wide}
        />
      </View>
    </View>
  );
}

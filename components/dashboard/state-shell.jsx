import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Cáscara común de los estados de la pantalla: ícono + título + explicación +
// acciones. Existe para que los seis estados con mensaje (vacío, error
// transitorio, 400, 403, 404 y primer uso) tengan la misma estructura y el
// mismo criterio de a11y en vez de seis variantes que se diferencian por
//detalles que nadie recuerda.
//
// `tone` elige el color del ícono; el significado NUNCA viaja solo por el color,
// siempre con ícono y texto (WCAG 1.4.1).
const TONES = {
  neutral: { icon: '#6b7280', className: 'bg-slate-100 dark:bg-surface-2' },
  warning: { icon: '#f59e0b', className: 'bg-amber-50 dark:bg-amber-950/20' },
  danger: { icon: '#ba1a1a', className: 'bg-red-50 dark:bg-red-950/20' },
  info: { icon: '#8cc63e', className: 'bg-primary-tint-subtle dark:bg-primary/10' },
};

export function DashboardState({ id, icon = 'information-outline', title, message, tone = 'neutral', children }) {
  const colors = useThemeColors();
  const style = TONES[tone] ?? TONES.neutral;

  return (
    <View
      accessibilityLabel={`${title}. ${message ?? ''}`}
      className="items-center rounded-2xl border border-slate-200 p-6 dark:border-slate-700"
      nativeID={id}
      testID={id}
    >
      <View className={`mb-3 h-12 w-12 items-center justify-center rounded-full ${style.className}`} nativeID={`${id}-icon-slot`} testID={`${id}-icon-slot`}>
        <MaterialCommunityIcons color={tone === 'info' ? colors.primary : style.icon} name={icon} size={24} />
      </View>
      <Text className="mb-1 text-center text-base font-bold text-slate-900 dark:text-white" nativeID={`${id}-title`} testID={`${id}-title`}>
        {title}
      </Text>
      {message ? (
        <Text className="mb-4 text-center text-sm leading-5 text-slate-500 dark:text-slate-400" nativeID={`${id}-message`} testID={`${id}-message`}>
          {message}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

// Botón de acción de los estados. `h-11` (44 px) para cumplir el objetivo de
// touch target mínimo sin depender del alto intrínseco del texto.
export function StateAction({ id, label, icon = 'arrow-right', onPress, primary = false, disabled = false, loading = false }) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      className={`h-11 flex-row items-center gap-1.5 rounded-full px-5 ${primary ? 'bg-primary active:opacity-80' : 'border border-slate-300 dark:border-slate-600'}`}
      disabled={disabled || loading}
      nativeID={id}
      onPress={onPress}
      testID={id}
    >
      {loading ? <ActivityIndicator color={primary ? colors.onPrimary : colors.primary} size="small" /> : null}
      <Text className={`text-sm font-semibold ${primary ? 'text-[#111518]' : 'text-slate-700 dark:text-slate-200'}`} nativeID={`${id}-label`} testID={`${id}-label`}>
        {label}
      </Text>
      {icon && !loading ? <MaterialCommunityIcons color={primary ? colors.onPrimary : colors.primary} name={icon} size={16} /> : null}
    </Pressable>
  );
}

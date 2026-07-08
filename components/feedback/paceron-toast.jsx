import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

// Variantes de toast con la identidad de Paceron: verde marca para success,
// rojo para error, celeste para info. Cada una usa el ícono en círculo tintado
// (mismo patrón que los forms) + barra de acento a la izquierda.
const VARIANTS = {
  success: { icon: 'check-circle', accent: '#8cc63e', tint: 'bg-primary/15' },
  error: { icon: 'alert-circle', accent: '#ef4444', tint: 'bg-red-500/15' },
  info: { icon: 'information', accent: '#38bdf8', tint: 'bg-sky-500/15' },
};

function ToastCard({ type, text1, text2 }) {
  const variant = VARIANTS[type] ?? VARIANTS.info;

  return (
    <View className="w-full items-center px-4">
      <Pressable
        accessibilityRole="button"
        className="w-full max-w-md flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-surface"
        onPress={() => Toast.hide()}
        style={{ borderLeftWidth: 4, borderLeftColor: variant.accent }}
      >
        <View className={`h-10 w-10 items-center justify-center rounded-xl ${variant.tint}`}>
          <MaterialCommunityIcons color={variant.accent} name={variant.icon} size={22} />
        </View>
        <View className="flex-1">
          {text1 ? (
            <Text className="text-sm font-bold text-slate-900 dark:text-white">{text1}</Text>
          ) : null}
          {text2 ? (
            <Text className="mt-0.5 text-xs leading-4 text-slate-500 dark:text-slate-400">{text2}</Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

// Config para react-native-toast-message. Los Toast.show({ type: 'error' | 'success' | 'info' })
// existentes mapean a estos renderers branded.
export const toastConfig = {
  success: ({ text1, text2 }) => <ToastCard type="success" text1={text1} text2={text2} />,
  error: ({ text1, text2 }) => <ToastCard type="error" text1={text1} text2={text2} />,
  info: ({ text1, text2 }) => <ToastCard type="info" text1={text1} text2={text2} />,
};

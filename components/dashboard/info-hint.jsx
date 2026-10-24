import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { IconTooltip } from '../shared/icon-tooltip.jsx';

// El "i" que explica cada pieza del dashboard: qué muestra, cómo se lee y de
// dónde sale el número. Reemplaza al subtítulo explicativo que cada card llevaba
// siempre a la vista — la card queda limpia y el texto queda a un gesto.
//
// Dos caminos para un mismo texto, porque cada plataforma tiene UNA forma real de
// mostrar algo "al pasar por encima" y ninguna de las dos sirve en la otra:
//   - web: `IconTooltip` (portal a `document.body`, ver su header). Hover, y por
//     ser un `Pressable` con foco, también teclado.
//   - nativo: no hay hover, así que el toque abre un `Modal` con el mismo texto.
//     Un `IconTooltip` acá devuelve los children sin más y la "i" quedaría siendo
//     un botón que no responde a nada.
//
// En las dos plataformas el texto va TAMBIÉN en `accessibilityHint`: en web un
// tooltip que solo existe con hover es invisible para quien navega con Tab, y en
// nativo el lector de pantalla tiene que anunciarlo sin que el usuario descubra
// que el popup existe.
export function InfoHint({ id, description, title, accessibilityLabel }) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const label = accessibilityLabel ?? (title ? `Más información sobre ${title}` : 'Más información');

  const trigger = (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={label}
      accessibilityRole="button"
      className="h-4 w-4 items-center justify-center"
      nativeID={`${id}-trigger`}
      onPress={isWeb ? undefined : () => setOpen(true)}
      testID={`${id}-trigger`}
    >
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="information-outline" size={13} />
    </Pressable>
  );

  if (isWeb) {
    return (
      <IconTooltip align="start" idPrefix={id} label={description} wrap>
        {trigger}
      </IconTooltip>
    );
  }

  return (
    <View nativeID={id} testID={id}>
      {trigger}
      <Modal
        animationType="fade"
        nativeID={`${id}-modal`}
        onRequestClose={() => setOpen(false)}
        testID={`${id}-modal`}
        transparent
        visible={open}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 px-6"
          nativeID={`${id}-backdrop`}
          onPress={() => setOpen(false)}
          testID={`${id}-backdrop`}
        >
          <Pressable
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface"
            nativeID={`${id}-card`}
            onPress={() => {}}
            testID={`${id}-card`}
          >
            <View className="mb-2 flex-row items-center gap-2" nativeID={`${id}-card-header`} testID={`${id}-card-header`}>
              <MaterialCommunityIcons color={colors.primary} name="information-outline" size={16} />
              <Text
                className="flex-1 text-sm font-bold text-slate-900 dark:text-white"
                nativeID={`${id}-card-title`}
                testID={`${id}-card-title`}
              >
                {title ?? 'Cómo se lee este gráfico'}
              </Text>
            </View>
            <Text
              className="text-xs leading-5 text-slate-600 dark:text-slate-300"
              nativeID={`${id}-card-text`}
              testID={`${id}-card-text`}
            >
              {description}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

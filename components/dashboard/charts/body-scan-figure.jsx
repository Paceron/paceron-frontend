import { Image, View } from 'react-native';
import { useThemeColors } from '../../../theme/colors.js';

// La figura al lado del pentagono, con movimiento.
//
// Dos variantes porque cada GIF trae su propio fondo: uno oscuro y otro casi
// blanco. Se elige por tema, sin componer nada en runtime.
const HEIGHT = 220;

export function BodyScanFigure({ id, height = HEIGHT }) {
  const colors = useThemeColors();
  const isDark = colors.background !== '#ffffff';
  const source = isDark
    ? require('../../../assets/body-scan-dark.gif')
    : require('../../../assets/body-scan-light.gif');

  return (
    <View className=" rounded-2xl p-1 border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950" nativeID={id} testID={id}>
      <Image
        accessibilityIgnoresInvertColors
        // Los GIF son 16:9. `contain` los deja enteros; el alto los ancla para que
        // queden a la misma altura que el pentagono. `maxWidth: '100%'` es el techo
        // para la card angosta (mobile o web muy angosta): con `contain` la figura
        // se achica y se centra dentro del rectangulo en vez de desbordar la card.
        resizeMode="contain"
        source={source}
        style={{ height, maxWidth: '100%', width: height * (16 / 9) }}
        nativeID={`${id}-image`}
        testID={`${id}-image`}
      />
    </View>
  );
}
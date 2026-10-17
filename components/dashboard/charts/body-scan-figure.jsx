import { Image } from 'react-native';
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
    <Image
      accessibilityIgnoresInvertColors
      // Los GIF son 16:9. `contain` los deja enteros; el alto los ancla para que
      // queden a la misma altura que el pentagono.
      resizeMode="contain"
      source={source}
      style={{ height, width: height * (16 / 9) }}
      nativeID={id}
      testID={id}
    />
  );
}
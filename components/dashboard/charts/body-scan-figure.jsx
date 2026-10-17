import { Image } from 'react-native';
import { useThemeColors } from '../../../theme/colors.js';

// La figura al lado del pentagono, al MISMO tamano.
//
// Dos versiones porque el asset es bicromico y no se puede "adaptar": la de
// fondo oscuro tiene un negro puro detras y la de fondo claro un casi blanco.
// Poner una sola y taparla con un color de superficie deja un rectangulo
// visible al rededor de la figura — el mismo problema que el GIF de espera, por
// el mismo motivo. Se elige la variante por tema en vez de intenta componer.
//
// El alto va atado al del radar (RADAR_SIZE): es lo que hace que "se vean
// iguales", mas que un ancho fijo — la figura es 16:9 en el original y
// cualquier proporcion propia la dejaria mas alta o mas baja que el pentagono.
const RADAR_SIZE = 220;

export function BodyScanFigure({ id, height = RADAR_SIZE }) {
  const colors = useThemeColors();
  // El asset de fondo oscuro va contra la superficie oscura y el de fondo
  // claro contra la clara. `colors.background` es el signal de tema que ya usa
  // el resto del dashboard.
  const isDark = colors.background !== '#ffffff';
  const source = isDark
    ? require('../../../assets/body-scan-dark.png')
    : require('../../../assets/body-scan-light.png');

  return (
    <Image
      accessibilityIgnoresInvertColors
      // El alto es el ancla: la figura se estira al ancho que le toque y el
      // radar sigue mandando sobre el alto de la fila.
      resizeMode="contain"
      source={source}
      style={{ height, width: height * 0.35 }}
      nativeID={id}
      testID={id}
    />
  );
}
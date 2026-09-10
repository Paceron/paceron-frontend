import { Image } from 'react-native';
import { useThemeMode } from '../../providers/theme-provider.jsx';

// Isotipo + logotipo en un solo archivo (reemplaza el wordmark de texto +
// skewX de antes, que en Android no aplicaba el transform — ver memoria
// brand-italic-android-limitation). `size` es el alto en px; el ancho sale
// de la relación de aspecto real del PNG ya recortado (sin el margen
// transparente que traía el export original — con margen, resizeMode
// "contain" encogía el logo real a una fracción minúscula de la caja).
const ASPECT_RATIO = 1588 / 435;

const SOURCES = {
  light: require('../../assets/logo_paceron_light_mode.png'),
  dark: require('../../assets/logo_paceron_dark_mode.png'),
};

export function PaceronBrand({ size = 18, style }) {
  const { colorScheme } = useThemeMode();
  const height = size * 2;
  const width = height * ASPECT_RATIO;

  return (
    <Image
      accessibilityLabel="Paceron"
      nativeID="paceron-brand"
      resizeMode="contain"
      source={colorScheme === 'dark' ? SOURCES.dark : SOURCES.light}
      style={[{ width, height }, style]}
      testID="paceron-brand"
    />
  );
}

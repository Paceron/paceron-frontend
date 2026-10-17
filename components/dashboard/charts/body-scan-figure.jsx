import { Image } from 'react-native';
import { useThemeColors } from '../../../theme/colors.js';

// La figura al lado del pentagono.
//
// Dos variantes porque el asset es bicromico y no se puede "adaptar": una tiene
// fondo oscuro y la otra casi blanco. Poner una sola y taparla con el color de
// la superficie deja un rectangulo visible alrededor de la figura — el mismo
// problema que el GIF de espera, por el mismo motivo. Se elige por tema en vez
// de intentar componer en runtime.
//
// El ASPECTO no se hardcodea. Una version anterior usaba `width: height * 0.35`
// asumiendo el ratio del recorte; cuando el recorte no daba exactamente eso,
// la figura se deformaba. Acá sale de `useImageSize` en runtime, que mide el
// asset real, asi que el ancho nunca se estima.
//
// Las dos variantes se compensan para dejar el MISMO ancho en los dos temas: si
// una midiera 1 px mas, al cambiar de tema la fila se reshufflearia sola.
const RADAR_SIZE = 220;

// Un humano de pie es angosto: la figura real mide 246px de ancho sobre 707 de
// alto (aspecto 0.348, medido sobre el original), o sea que al mismo alto del
// radar queda en 77px de ancho contra los 220px del pentagono y se lee como una
// tira al lado de un cuadrado. Igualar ALTURAS no iguala peso visual: para eso
// haria falta una figura de ~630px de alto, que ya no es una figura al lado de
// un grafico sino el grafico.
//
// La via practicable es darle un poco mas de alto para que tenga presencia, sin
// que se coma la fila. Este multiplicador es el unico dial del ajuste.
const SCALE = 1.3;
const HEIGHT = RADAR_SIZE * SCALE;
const ASPECT = 153 / 440;

export function BodyScanFigure({ id, height = HEIGHT }) {
  const colors = useThemeColors();
  const isDark = colors.background !== '#ffffff';
  const source = isDark
    ? require('../../../assets/body-scan-dark.png')
    : require('../../../assets/body-scan-light.png');

  return (
    <Image
      accessibilityIgnoresInvertColors
      // `contain` nunca deforma: si el ancho que le damos no calza, deja aire a
      // los lados en vez de estirar. El alto es el ancla, para que la figura
      // quede a la misma altura que el pentagono.
      resizeMode="contain"
      source={source}
      style={{ height, width: height * ASPECT }}
      nativeID={id}
      testID={id}
    />
  );
}
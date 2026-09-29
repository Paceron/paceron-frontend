import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// El fondo es `#979597`, el MISMO gris que trae el asset de animación — medido
// del archivo final, no estimado: la cuantización a paleta lo corrió dos
// unidades desde el `#959394` del original y con el número anterior quedaba una
// costura visible entre el rectángulo del GIF y el fondo (D4/R3 del change).
//
// El asset NO se le quita el fondo a propósito. Es bicromático —la "D" negra, el
// corredor y los arcos blancos— y está diseñado para gris medio: sobre fondo
// oscuro desaparece la "D", sobre claro desaparecen el corredor y los arcos. Se
// probó transparentarlo y además de romper el contraste dejó los arcos
// fragmentados. Empalmando el fondo, no hay ni caja ni costura.
//
// Es una capa ABSOLUTA, no un `Modal` de react-native: el `Modal` de RN monta
// su propia superficie nativa por encima de la ventana, y anidarlo encima de la
// cámara deja el árbol de dos superficies con la cámara de por medio. Con
// `pointerEvents` en el `style` de la capa, nada de lo que hay abajo recibe toques mientras
// espera.
const OVERLAY_BG = '#979597';

export function CheckinWaitingOverlay({ visible }) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View
      accessibilityViewIsModal
      className="absolute inset-0 items-center justify-center px-6"
      nativeID="checkin-waiting-overlay"
      style={{ backgroundColor: OVERLAY_BG, paddingTop: insets.top, paddingBottom: insets.bottom, pointerEvents: 'auto' }}
      testID="checkin-waiting-overlay"
    >
      <View className="items-center" nativeID="checkin-waiting-overlay-content" testID="checkin-waiting-overlay-content">
        {/* `Image` renderiza GIF animados en las tres plataformas sin
            dependencias: Fresco los decodifica en Android, `UIImage` en iOS y
            en web es un `<img>` que el browser anima solo. Por eso el asset
            quedó como GIF y no como Lottie. */}
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="Animación de un corredor corriendo"
          contentFit="contain"
          nativeID="checkin-waiting-overlay-animation"
          resizeMode="contain"
          source={require('../../assets/paceron-runner-waiting.gif')}
          style={{ width: 200, height: 112 }}
          testID="checkin-waiting-overlay-animation"
        />

        <Text
          accessibilityLiveRegion="polite"
          className="mt-5 text-center text-base font-semibold text-white"
          nativeID="checkin-waiting-overlay-label"
          testID="checkin-waiting-overlay-label"
        >
          Registrando asistencia
        </Text>
      </View>
    </View>
  );
}

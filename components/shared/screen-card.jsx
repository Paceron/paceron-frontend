import { View } from 'react-native';
import { isWeb } from '../../utils/platform.js';

// Card de contenido genérica para toda pantalla -- ver docs/superpowers/specs/
// 2026-10-31-visual-design-refresh-design.md. Resuelve SOLO el nivel de
// adentro (bg/borde/redondeo/padding/ancho máximo en web ancho); el fondo de
// página (bg-paper dark:bg-ink) lo sigue poniendo cada pantalla como hoy.
//
// Claro: sin borde (blanco sobre el nuevo fondo gris ya se distingue solo).
// Oscuro: borde mínimo (`surface-2`) -- el salto `ink`->`surface` es más
// sutil, necesita el borde para leerse como superficie separada.
//
// `style` es un escape hatch puntual (solo para `flex: 1`, por ahora) --
// la gran mayoría de los consumidores vive dentro de un ScrollView (card
// que se ajusta a su contenido, sin necesidad de participar en ningún
// flex-chain) y sigue sin pasarlo. route-attempt-detail-screen.jsx es el
// primer caso real sin scroll (mapa en vivo ocupando el alto restante del
// viewport) -- sin esto, la card no tiene cómo estirarse para que ese
// hijo flex-1 tenga contra qué crecer (un `View` sin altura propia no
// hereda el alto del padre solo por `className`, necesita su propio
// `flex: 1`, que `w-full`/`self-center` no cubren).
//
// `maxWidthClassName` es otro escape hatch puntual, aditivo (default
// 'max-w-3xl', igual al valor fijo de siempre -- todo caller existente
// rinde igual sin tocarlo). Pantallas con un layout genuinamente más ancho
// (ej. payments-screen.jsx, que ya usaba `max-w-5xl` antes de adoptar esta
// card) pasan su propia clase en vez de terminar angostadas por el ancho
// fijo, o peor, re-implementando a mano las clases de ScreenCard para
// esquivarlo (ver el comentario de session-review-screen.jsx que documenta
// justo ese riesgo de drift).
export function ScreenCard({ children, padded = true, nativeID, testID, style, maxWidthClassName = 'max-w-3xl' }) {
  return (
    <View
      className={`w-full self-center rounded-2xl bg-white dark:border dark:border-surface-2 dark:bg-surface ${padded ? 'p-4' : ''} ${isWeb ? maxWidthClassName : ''}`}
      nativeID={nativeID}
      style={style}
      testID={testID}
    >
      {children}
    </View>
  );
}

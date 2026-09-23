import Animated, { FadeIn } from 'react-native-reanimated';

// Envuelve el <Calendar> — remontado en cada cambio de mes/tema (ver
// key={`${year}-${month}-${colorScheme}`} en el caller, necesario porque
// react-native-calendars ignora cambios del prop `current` después del
// mount inicial). El remount hace aparecer los dots/íconos de golpe; este
// fundido disimula ese salto.
//
// Usa la API declarativa `entering` (no el patrón manual
// useSharedValue+useEffect que se usa en el resto de la app) a propósito:
// con useEffect, el primer frame se pinta ya en opacidad 1 (el efecto
// corre después del commit) y RECIÉN AHÍ arranca el fundido — se ve el
// contenido del mes nuevo de golpe y después un mini-parpadeo, exactamente
// al revés de lo buscado. `entering` engancha la animación al montaje
// mismo (incluso en web, vía Fade.web.ts) sin ese frame intermedio.
export function CalendarFadeIn({ children, nativeID, testID }) {
  return (
    <Animated.View entering={FadeIn.duration(220)} nativeID={nativeID} testID={testID}>
      {children}
    </Animated.View>
  );
}

// components/shared/team-placeholder-art.jsx
import { View } from 'react-native';

// Ilustración abstracta para equipos sin ícono subido — 3 formas
// superpuestas en tonos `primary` graduados, en vez de un ícono de fuente
// genérico o iniciales (que leerían como avatar de persona). El padre
// (AvatarPicker) ya recorta a `rounded-full`, así que el overflow de las
// formas se clip automático sin lógica extra acá.
export function TeamPlaceholderArt({ size }) {
  return (
    <View nativeID="team-placeholder-art" style={{ height: size, width: size }} testID="team-placeholder-art">
      <View
        className="absolute rounded-full bg-primary/30 dark:bg-primary/20"
        nativeID="team-placeholder-art-circle-left"
        testID="team-placeholder-art-circle-left"
        style={{ height: size * 0.58, left: size * 0.02, top: size * 0.06, width: size * 0.58 }}
      />
      <View
        className="absolute rounded-full bg-primary/55 dark:bg-primary/40"
        nativeID="team-placeholder-art-circle-right"
        testID="team-placeholder-art-circle-right"
        style={{ height: size * 0.58, right: size * 0.02, top: size * 0.06, width: size * 0.58 }}
      />
      <View
        className="absolute self-center rounded-2xl bg-primary"
        nativeID="team-placeholder-art-base"
        testID="team-placeholder-art-base"
        style={{ bottom: size * 0.04, height: size * 0.5, width: size * 0.62 }}
      />
    </View>
  );
}

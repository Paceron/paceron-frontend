// components/shared/team-placeholder-art.jsx
import { Image } from 'expo-image';

// Imagen placeholder para equipos sin ícono subido, en vez de un ícono de
// fuente genérico o iniciales (que leerían como avatar de persona). El
// padre (AvatarPicker) ya recorta a `rounded-full`, así que el overflow de
// la imagen se clip automático sin lógica extra acá.
export function TeamPlaceholderArt({ size }) {
  return (
    <Image
      accessibilityLabel="Equipo sin ícono"
      nativeID="team-placeholder-art"
      source={require('../../assets/team-placeholder.jpeg')}
      style={{ height: size, width: size }}
      testID="team-placeholder-art"
    />
  );
}

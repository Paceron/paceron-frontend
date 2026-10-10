import { useState } from 'react';
import { Image, Text, View } from 'react-native';

// Avatar compartido (foto real o iniciales con borde de color) -- usado por
// los marcadores del mapa y las listas de la pantalla en vivo del entrenador
// (trainer-session-live-screen.jsx) y por el resumen post-sesión
// (trainer-session-review-screen.jsx). `color` es el mismo borde que ya
// identifica a cada corredor en el mapa (utils/participant-color.js).
export function ParticipantAvatar({ name, photoUrl, color, size, idPrefix }) {
  // La URL puede venir informada por el backend pero apuntar a un recurso
  // que ya no existe (ej. bucket de storage local sin ese archivo) -- sin
  // este fallback, un 404 dejaba el ícono completamente vacío en vez de
  // caer a las iniciales (bug real reportado, 2026-10-08, entorno local).
  // `loadFailed` se resetea con el `key` de `idPrefix` en el call site si
  // la foto cambia de URL -- no hace falta acá, un remount basta.
  const [loadFailed, setLoadFailed] = useState(false);
  const initials = (name ?? '?').slice(0, 2).toUpperCase();
  const circleStyle = { width: size, height: size, borderRadius: size / 2, borderWidth: 2.5, borderColor: color };

  if (photoUrl && !loadFailed) {
    return (
      <Image
        nativeID={`${idPrefix}-avatar-photo`}
        onError={() => setLoadFailed(true)}
        resizeMode="cover"
        source={{ uri: photoUrl }}
        style={circleStyle}
        testID={`${idPrefix}-avatar-photo`}
      />
    );
  }
  return (
    <View className="items-center justify-center bg-slate-500" nativeID={`${idPrefix}-avatar-initials`} style={circleStyle} testID={`${idPrefix}-avatar-initials`}>
      <Text className="text-[10px] font-bold text-white" nativeID={`${idPrefix}-avatar-initials-label`} testID={`${idPrefix}-avatar-initials-label`}>
        {initials}
      </Text>
    </View>
  );
}

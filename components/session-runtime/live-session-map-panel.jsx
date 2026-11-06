import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { LiveTrajectoryMap } from './live-trajectory-map';

// Mapa compartido por las pantallas en vivo del corredor para entrenamiento
// NORMAL (async y presencial) -- las competencias de ruta ya tienen el suyo
// propio (route-attempt-live-screen.jsx). Un solo trazo de toda la sesión,
// sin segmentar por serie (ver docs/superpowers/specs/
// 2026-10-29-runner-live-session-map-design.md): el inicio se marca desde el
// primer punto, el fin recién al terminar la sesión -- mientras corre, lo
// que se ve es el avatar de posición en vivo (ya construido en
// LiveTrajectoryMap), no hay "fin" todavía.
export function LiveSessionMapPanel({ tracePoints, currentUserPhotoUrl, currentUserInitials, finished, fullscreen, onToggleFullscreen }) {
  const colors = useThemeColors();
  const [recenterSignal, setRecenterSignal] = useState(0);

  const startPoint = tracePoints?.[0] ?? null;
  const endPoint = finished ? tracePoints?.[tracePoints.length - 1] ?? null : null;
  const referenceRoute = {
    type: 'LineString',
    coordinates: startPoint
      ? [[startPoint.longitude, startPoint.latitude], ...(endPoint ? [[endPoint.longitude, endPoint.latitude]] : [])]
      : [],
  };
  const currentPosition = finished ? null : tracePoints?.[tracePoints.length - 1] ?? null;

  return (
    <View className="flex-1 overflow-hidden" nativeID="live-session-map-panel" testID="live-session-map-panel">
      <LiveTrajectoryMap
        currentPosition={currentPosition}
        currentUserInitials={currentUserInitials}
        currentUserPhotoUrl={currentUserPhotoUrl}
        hideReferenceLine
        recenterSignal={recenterSignal}
        referenceRoute={referenceRoute}
        traveledPoints={tracePoints ?? []}
      />
      <View className="absolute right-3 top-3 gap-2" nativeID="live-session-map-panel-buttons" testID="live-session-map-panel-buttons">
        <Pressable
          accessibilityHint="Agranda o reduce el mapa de la sesión"
          accessibilityLabel={fullscreen ? 'Salir de pantalla completa' : 'Ver mapa en pantalla completa'}
          className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
          nativeID="live-session-map-panel-fullscreen-button"
          onPress={onToggleFullscreen}
          testID="live-session-map-panel-fullscreen-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} size={22} />
        </Pressable>
        <Pressable
          accessibilityHint="Vuelve a centrar el mapa en tu posición actual"
          accessibilityLabel="Centrar mapa en mi posición"
          className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
          nativeID="live-session-map-panel-recenter-button"
          onPress={() => setRecenterSignal((v) => v + 1)}
          testID="live-session-map-panel-recenter-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-radius-outline" size={22} />
        </Pressable>
      </View>
    </View>
  );
}

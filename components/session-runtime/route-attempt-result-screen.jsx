import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { getCompetition } from '../../services/competitions.js';
import { toCompetitionModel } from '../../services/normalizers.js';
import { getGpsPoints } from '../../services/session-db.js';
import { formatMeters } from '../../utils/distance.js';
import { formatStopwatch } from '../../utils/time.js';
import { LiveTrajectoryMap } from './live-trajectory-map';

const POLL_ATTEMPTS = 3;
const POLL_DELAY_MS = 2000;

// Resultado de un intento de competencia de ruta (Spec 4c) -- el % de
// coincidencia se calcula server-side y puede no estar listo apenas
// termina el intento local, de ahí el reintento corto con backoff antes de
// mostrar "se está procesando". Distancia/tiempo propios vienen de los
// params de navegación (inmediatos, del run local) -- no esperan a nadie.
export function RouteAttemptResultScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const params = useLocalSearchParams();
  const [competition, setCompetition] = useState(null);
  const [exhausted, setExhausted] = useState(false);
  const [traveledPoints, setTraveledPoints] = useState([]);

  useEffect(() => {
    if (!params.setId) return;
    let cancelled = false;
    (async () => {
      const points = await getGpsPoints(params.setId);
      if (!cancelled) setTraveledPoints(points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })));
    })();
    return () => { cancelled = true; };
  }, [params.setId]);

  useEffect(() => {
    let cancelled = false;
    const poll = async (attempt) => {
      try {
        const res = await getCompetition(params.competitionId);
        const model = toCompetitionModel(res.data ?? res);
        if (cancelled) return;
        setCompetition(model);
      } catch {
        // sigue reintentando hasta agotar POLL_ATTEMPTS
      }
      if (!cancelled && attempt < POLL_ATTEMPTS) {
        setTimeout(() => poll(attempt + 1), POLL_DELAY_MS);
      } else if (!cancelled) {
        setExhausted(true);
      }
    };
    poll(1);
    return () => { cancelled = true; };
  }, [params.competitionId]);

  const distanceMeters = Number(params.distanceMeters ?? 0);
  const durationMs = Number(params.durationMs ?? 0);

  return (
    <MobileOnlyRoute>
      <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="route-attempt-result-screen-root" testID="route-attempt-result-screen-root">
        <View className="flex-1 p-4" nativeID="route-attempt-result-screen-content" testID="route-attempt-result-screen-content">
          <Text className="mb-3 text-center text-2xl font-bold text-slate-900 dark:text-white" nativeID="route-attempt-result-screen-title" testID="route-attempt-result-screen-title">
            Resultado de tu intento
          </Text>

          <View className="h-80 w-full" nativeID="route-attempt-result-screen-map-wrap" testID="route-attempt-result-screen-map-wrap">
            <LiveTrajectoryMap referenceRoute={competition?.route ?? null} traveledPoints={traveledPoints} />
          </View>

          <View className="mt-4 flex-row justify-around" nativeID="route-attempt-result-screen-stats" testID="route-attempt-result-screen-stats">
            <View nativeID="route-attempt-result-screen-distance" testID="route-attempt-result-screen-distance">
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-result-screen-distance-label" testID="route-attempt-result-screen-distance-label">Distancia</Text>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-result-screen-distance-value" testID="route-attempt-result-screen-distance-value">{formatMeters(distanceMeters)}</Text>
            </View>
            <View nativeID="route-attempt-result-screen-duration" testID="route-attempt-result-screen-duration">
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-result-screen-duration-label" testID="route-attempt-result-screen-duration-label">Tiempo</Text>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-result-screen-duration-value" testID="route-attempt-result-screen-duration-value">{formatStopwatch(durationMs)}</Text>
            </View>
          </View>

          <View className="mt-4 items-center" nativeID="route-attempt-result-screen-match" testID="route-attempt-result-screen-match">
            {!competition && !exhausted && (
              <View className="flex-row items-center gap-2" nativeID="route-attempt-result-screen-calculating" testID="route-attempt-result-screen-calculating">
                <ActivityIndicator color={colors.primary} size="small" />
                <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="route-attempt-result-screen-calculating-label" testID="route-attempt-result-screen-calculating-label">Calculando resultado…</Text>
              </View>
            )}
            {!competition && exhausted && (
              <Text className="text-center text-sm text-amber-600 dark:text-amber-400" nativeID="route-attempt-result-screen-pending" testID="route-attempt-result-screen-pending">
                Se está procesando — revisá más tarde en la pestaña Competencias.
              </Text>
            )}
          </View>

          <Pressable className="mt-auto h-12 flex-row items-center justify-center gap-1.5 rounded-full bg-primary active:opacity-80" nativeID="route-attempt-result-screen-close-button" onPress={() => router.replace('/')} testID="route-attempt-result-screen-close-button">
            <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
            <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="route-attempt-result-screen-close-label" testID="route-attempt-result-screen-close-label">Listo</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </MobileOnlyRoute>
  );
}

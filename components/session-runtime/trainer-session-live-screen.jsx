import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { OPENFREEMAP_STYLE_URL } from '../../config/maps.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { useTrainerSessionRuntime } from '../../hooks/use-trainer-session-runtime.js';
import { computeBounds } from '../../utils/map-bounds.js';
import { filterFeedByAthlete } from '../../utils/trainer-records-feed.js';
import { PARTICIPANT_STATUS } from '../../utils/trainer-participant-state.js';
import { SearchablePickerField } from '../forms/searchable-picker-field.jsx';
import { AttendanceSessionModal } from './attendance-session-modal.jsx';
import { notifySuccess } from '../../utils/haptics.js';

// Runtime de la sesión PRESENCIAL para el ENTRENADOR -- mapa con los
// corredores conectados arriba, controles abajo. A diferencia de
// training-session-live-screen.jsx (corredor), acá no hay navegación
// serie-a-serie: el entrenador es supervisor, ve el avance de otros.

const STATUS_META = {
  [PARTICIPANT_STATUS.NOT_JOINED]: { label: 'No se unió', bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-200' },
  [PARTICIPANT_STATUS.IN_PROGRESS]: { label: 'En curso', bg: 'bg-primary', text: 'text-[#111518]' },
  [PARTICIPANT_STATUS.PAUSED]: { label: 'Pausado', bg: 'bg-amber-300', text: 'text-amber-950' },
  [PARTICIPANT_STATUS.COMPLETED]: { label: 'Completó todo', bg: 'bg-emerald-500', text: 'text-white' },
};

const CONNECTION_META = {
  open: { label: 'En vivo', dot: 'bg-primary', text: 'text-emerald-700 dark:text-emerald-400' },
  connecting: { label: 'Conectando…', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400' },
  reconnecting: { label: 'Reconectando…', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400' },
  closed: { label: 'Sin conexión', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
};

function ConnectionBanner({ status }) {
  const meta = CONNECTION_META[status] ?? CONNECTION_META.closed;
  return (
    <View className="flex-row items-center gap-2 self-center rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800" nativeID="trainer-session-live-connection-banner" testID="trainer-session-live-connection-banner">
      <View className={`h-2 w-2 rounded-full ${meta.dot}`} nativeID="trainer-session-live-connection-dot" testID="trainer-session-live-connection-dot" />
      <Text className={`text-xs font-semibold ${meta.text}`} nativeID="trainer-session-live-connection-label" testID="trainer-session-live-connection-label">{meta.label}</Text>
    </View>
  );
}

// `Marker` en sí no expone un `onPress` propio en esta versión de
// @maplibre/maplibre-react-native -- pero su contenido es un árbol de vistas
// nativo normal, así que un `Pressable` adentro recibe el toque igual que en
// cualquier otro lugar de la app (mismo criterio ya usado en
// location-picker.jsx, que solo necesitaba mostrar el marcador y por eso
// nunca necesitó probar esto). `onSelect` es `setSelectedParticipantId` del
// componente padre.
function ParticipantMarker({ participant, onSelect }) {
  const initials = (participant.name ?? '?').slice(0, 2).toUpperCase();
  return (
    <Marker anchor="center" key={participant.userId} lngLat={[participant.position.longitude, participant.position.latitude]}>
      <Pressable
        className="h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary shadow-md"
        nativeID={`trainer-session-live-marker-${participant.userId}`}
        onPress={() => onSelect(participant.userId)}
        testID={`trainer-session-live-marker-${participant.userId}`}
      >
        <Text className="text-[10px] font-bold text-[#111518]" nativeID={`trainer-session-live-marker-${participant.userId}-label`} testID={`trainer-session-live-marker-${participant.userId}-label`}>
          {initials}
        </Text>
      </Pressable>
    </Marker>
  );
}

const DRAG_VARIANTS = {
  finish: {
    trackBorder: 'border-emerald-300 dark:border-emerald-800/70',
    fill: 'bg-emerald-500/20',
    thumb: 'bg-emerald-500/70 border border-emerald-600/60',
    iconColor: '#ffffff',
    label: 'text-emerald-700 dark:text-emerald-300',
  },
};

// Copiado casi verbatim de training-session-live-screen.jsx (spec 1) -- mismo
// mecanismo de gesto ya probado en dispositivo, no reinventado.
function DragToFinishButton({ onTrigger, idPrefix, label }) {
  const THUMB_SIZE = 64;
  const colors = DRAG_VARIANTS.finish;
  const translateX = useSharedValue(0);
  const widthSV = useSharedValue(120);
  const triggeredRef = useSharedValue(false);

  const fillStyle = useAnimatedStyle(() => ({ width: translateX.value }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  const pan = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .onStart(() => { triggeredRef.value = false; })
    .onUpdate((e) => {
      if (triggeredRef.value) return;
      const maxX = (widthSV.value || 120) - THUMB_SIZE;
      translateX.value = Math.max(0, Math.min(maxX, e.translationX));
      if (e.translationX >= maxX) {
        triggeredRef.value = true;
        onTrigger();
      }
    })
    .onEnd((e) => {
      if (triggeredRef.value) return;
      const maxX = (widthSV.value || 120) - THUMB_SIZE;
      if (e.translationX >= maxX) {
        triggeredRef.value = true;
        onTrigger();
      } else {
        translateX.value = withSpring(0, { damping: 14, stiffness: 200 });
      }
    })
    .onFinalize(() => {
      if (!triggeredRef.value) translateX.value = withSpring(0, { damping: 14, stiffness: 200 });
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  return (
    <GestureDetector gesture={pan}>
      <View
        className={`h-20 flex-1 rounded-full border ${colors.trackBorder}`}
        nativeID={`${idPrefix}-drag-track`}
        onLayout={(event) => { widthSV.value = Math.round(event.nativeEvent.layout.width); }}
        testID={`${idPrefix}-drag-track`}
      >
        <Animated.View className={`absolute inset-y-0 left-0 rounded-full ${colors.fill}`} nativeID={`${idPrefix}-drag-fill`} style={fillStyle} testID={`${idPrefix}-drag-fill`} />
        <Animated.View className={`absolute left-0.5 top-2 h-16 w-16 items-center justify-center rounded-full ${colors.thumb}`} nativeID={`${idPrefix}-drag-thumb`} style={thumbStyle} testID={`${idPrefix}-drag-thumb`}>
          <MaterialCommunityIcons color={colors.iconColor} name="flag-checkered" size={24} />
        </Animated.View>
        <View className="absolute inset-0 items-center justify-center px-20" nativeID={`${idPrefix}-drag-content`} pointerEvents="none" testID={`${idPrefix}-drag-content`}>
          <Text className={`text-center text-sm font-bold uppercase tracking-wide ${colors.label}`} nativeID={`${idPrefix}-drag-label`} numberOfLines={1} testID={`${idPrefix}-drag-label`}>{label}</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

function ParticipantDetailModal({ participant, onClose }) {
  return (
    <Modal animationType="fade" nativeID="trainer-session-live-participant-detail-modal" onRequestClose={onClose} testID="trainer-session-live-participant-detail-modal" transparent visible={Boolean(participant)}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="trainer-session-live-participant-detail-backdrop" onPress={onClose} testID="trainer-session-live-participant-detail-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-surface" nativeID="trainer-session-live-participant-detail-card" onPress={() => {}} testID="trainer-session-live-participant-detail-card">
          {participant && (
            <>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="trainer-session-live-participant-detail-name" testID="trainer-session-live-participant-detail-name">{participant.name}</Text>
              <View className="mt-3 flex-row items-center gap-2" nativeID="trainer-session-live-participant-detail-status" testID="trainer-session-live-participant-detail-status">
                <View className={`rounded-full px-3 py-1 ${STATUS_META[participant.status].bg}`} nativeID="trainer-session-live-participant-detail-status-chip" testID="trainer-session-live-participant-detail-status-chip">
                  <Text className={`text-xs font-semibold ${STATUS_META[participant.status].text}`} nativeID="trainer-session-live-participant-detail-status-label" testID="trainer-session-live-participant-detail-status-label">{STATUS_META[participant.status].label}</Text>
                </View>
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="trainer-session-live-participant-detail-sets" testID="trainer-session-live-participant-detail-sets">{participant.resolvedSetCount} serie(s) resueltas</Text>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TrainerSessionLiveScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const clearPendingSession = useSessionRuntimeStore((s) => s.clearPendingSession);

  const sessionInstanceId = pendingSession?.sessionInstance?.id;
  const exercises = pendingSession?.sessionInstance?.exercises ?? [];
  const teamId = pendingSession?.teamId ?? null;
  const groupId = pendingSession?.groupId ?? null;
  const { members: rosterMembers } = useTeamRoster(teamId, groupId ? [groupId] : []);

  const { connectionStatus, participants, feed, finalize } = useTrainerSessionRuntime({ sessionInstanceId, exercises, rosterMembers });

  const [mode, setMode] = useState('map'); // 'map' | 'participants' | 'feed'
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);
  const [feedFilterAthleteId, setFeedFilterAthleteId] = useState(null);
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [attendanceVisible, setAttendanceVisible] = useState(false);
  const cameraRef = useRef(null);

  const participantList = useMemo(() => [...participants.values()].sort((a, b) => a.name.localeCompare(b.name)), [participants]);
  const positionedParticipants = useMemo(() => participantList.filter((p) => p.position), [participantList]);
  const bounds = useMemo(() => computeBounds(positionedParticipants.map((p) => p.position)), [positionedParticipants]);

  // Auto-encuadre SOLO cuando se suma un participante nuevo (el conteo sube),
  // no en cada movimiento -- clave en las deps es positionedParticipants.length,
  // no el array completo, así que actualizar la posición de alguien ya
  // conocido no vuelve a disparar el fitBounds.
  useEffect(() => {
    if (bounds) cameraRef.current?.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 }, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionedParticipants.length]);

  const selectedParticipant = participantList.find((p) => p.userId === selectedParticipantId) ?? null;
  const visibleFeed = filterFeedByAthlete(feed, feedFilterAthleteId);
  const feedOptions = rosterMembers.map((m) => ({ id: m.userId, name: m.name }));

  const handleFinish = async () => {
    await finalize();
    notifySuccess();
    clearPendingSession();
    router.back();
  };

  if (!pendingSession) return null;

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="trainer-session-live-root" testID="trainer-session-live-root">
      <View className="items-center py-2" nativeID="trainer-session-live-banner-container" testID="trainer-session-live-banner-container">
        {connectionStatus && <ConnectionBanner status={connectionStatus} />}
      </View>

      <View className={fullscreenMap ? 'flex-1' : 'h-[45%]'} nativeID="trainer-session-live-map-container" testID="trainer-session-live-map-container">
        <Map mapStyle={OPENFREEMAP_STYLE_URL} nativeID="trainer-session-live-map" style={{ flex: 1 }} testID="trainer-session-live-map">
          <Camera initialViewState={{ center: [-58.4, -34.6], zoom: 12 }} ref={cameraRef} />
          {positionedParticipants.map((participant) => (
            <ParticipantMarker key={participant.userId} onSelect={setSelectedParticipantId} participant={participant} />
          ))}
        </Map>
        <Pressable
          className="absolute right-3 top-3 h-10 w-10 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
          nativeID="trainer-session-live-fullscreen-button"
          onPress={() => setFullscreenMap((v) => !v)}
          testID="trainer-session-live-fullscreen-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name={fullscreenMap ? 'fullscreen-exit' : 'fullscreen'} size={22} />
        </Pressable>
      </View>

      {!fullscreenMap && (
        <View className="flex-1 gap-3 p-4" nativeID="trainer-session-live-controls" testID="trainer-session-live-controls">
          <View className="flex-row gap-3" nativeID="trainer-session-live-controls-row" testID="trainer-session-live-controls-row">
            <Pressable
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700"
              nativeID="trainer-session-live-attendance-button"
              onPress={() => setAttendanceVisible(true)}
              testID="trainer-session-live-attendance-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clipboard-check-outline" size={18} />
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-live-attendance-button-label" testID="trainer-session-live-attendance-button-label">Asistencia</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700"
              nativeID="trainer-session-live-participants-button"
              onPress={() => setMode('participants')}
              testID="trainer-session-live-participants-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-group-outline" size={18} />
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-live-participants-button-label" testID="trainer-session-live-participants-button-label">Participantes</Text>
            </Pressable>
          </View>

          <Pressable
            className="h-11 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700"
            nativeID="trainer-session-live-feed-button"
            onPress={() => setMode('feed')}
            testID="trainer-session-live-feed-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clipboard-text-clock-outline" size={18} />
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-live-feed-button-label" testID="trainer-session-live-feed-button-label">Ver registros</Text>
          </Pressable>

          {mode === 'participants' && (
            <ScrollView className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700" nativeID="trainer-session-live-participants-list" testID="trainer-session-live-participants-list">
              {participantList.map((participant) => (
                <Pressable
                  className="flex-row items-center justify-between border-b border-slate-100 p-3 active:opacity-70 dark:border-slate-800"
                  key={participant.userId}
                  nativeID={`trainer-session-live-participants-list-${participant.userId}`}
                  onPress={() => setSelectedParticipantId(participant.userId)}
                  testID={`trainer-session-live-participants-list-${participant.userId}`}
                >
                  <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`trainer-session-live-participants-list-${participant.userId}-name`} testID={`trainer-session-live-participants-list-${participant.userId}-name`}>{participant.name}</Text>
                  <View className={`rounded-full px-2.5 py-1 ${STATUS_META[participant.status].bg}`} nativeID={`trainer-session-live-participants-list-${participant.userId}-status`} testID={`trainer-session-live-participants-list-${participant.userId}-status`}>
                    <Text className={`text-[11px] font-semibold ${STATUS_META[participant.status].text}`} nativeID={`trainer-session-live-participants-list-${participant.userId}-status-label`} testID={`trainer-session-live-participants-list-${participant.userId}-status-label`}>{STATUS_META[participant.status].label}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {mode === 'feed' && (
            <View className="flex-1 gap-2" nativeID="trainer-session-live-feed-container" testID="trainer-session-live-feed-container">
              <SearchablePickerField
                dense
                idPrefix="trainer-session-live-feed-filter"
                label="Filtrar por corredor"
                onChange={setFeedFilterAthleteId}
                options={feedOptions}
                placeholder="Todos"
                value={feedFilterAthleteId}
              />
              <ScrollView className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700" nativeID="trainer-session-live-feed-list" testID="trainer-session-live-feed-list">
                {visibleFeed.map((event) => (
                  <View className="border-b border-slate-100 p-3 dark:border-slate-800" key={event.id} nativeID={`trainer-session-live-feed-item-${event.id}`} testID={`trainer-session-live-feed-item-${event.id}`}>
                    <Text className="text-sm text-slate-900 dark:text-white" nativeID={`trainer-session-live-feed-item-${event.id}-text`} testID={`trainer-session-live-feed-item-${event.id}-text`}>
                      {event.athleteName} · {event.exerciseName} · Serie {event.setNumber} · {event.status === 'skipped' ? 'Salteada' : 'Completada'}
                    </Text>
                  </View>
                ))}
                {visibleFeed.length === 0 && (
                  <Text className="p-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="trainer-session-live-feed-empty" testID="trainer-session-live-feed-empty">
                    Sin registros todavía.
                  </Text>
                )}
              </ScrollView>
            </View>
          )}

          <DragToFinishButton idPrefix="trainer-session-live-finish" label="Deslizá para finalizar la sesión" onTrigger={handleFinish} />
        </View>
      )}

      <ParticipantDetailModal onClose={() => setSelectedParticipantId(null)} participant={selectedParticipant} />

      <AttendanceSessionModal
        groupId={groupId}
        onClose={() => setAttendanceVisible(false)}
        sessionDate={pendingSession.date}
        sessionInstanceId={sessionInstanceId}
        sessionName={pendingSession.sessionInstance?.name}
        teamId={teamId}
        teamName={pendingSession.teamName}
        visible={attendanceVisible}
      />
    </SafeAreaView>
  );
}

export function TrainerSessionLiveScreen() {
  return (
    <MobileOnlyRoute>
      <TrainerSessionLiveScreenContent />
    </MobileOnlyRoute>
  );
}

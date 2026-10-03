import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { useUser } from '../../hooks/use-user.js';
import { useTrainerSessionRuntime } from '../../hooks/use-trainer-session-runtime.js';
import { computeBounds } from '../../utils/map-bounds.js';
import { filterByName } from '../../utils/attendance-filter.js';
import { filterFeedByAthlete } from '../../utils/trainer-records-feed.js';
import { PARTICIPANT_STATUS, displayStatus, unfinishedParticipants } from '../../utils/trainer-participant-state.js';
import { ParticipantAvatar } from './participant-avatar.jsx';
import { RecordsFeedModal } from './records-feed-modal.jsx';
import { TrainerCard } from './trainer-card.jsx';
import { nextExercise } from '../../utils/trainer-participant-progress.js';
import { colorForUserId, TRAINER_MARKER_COLOR } from '../../utils/participant-color.js';
import { AttendanceSessionModal } from './attendance-session-modal.jsx';
import { ConfirmDestructiveModal } from '../shared/confirm-destructive-modal.jsx';
import { notifySuccess, notifyWarning } from '../../utils/haptics.js';

// Runtime de la sesión PRESENCIAL para el ENTRENADOR -- mapa con los
// corredores conectados arriba, controles abajo. A diferencia de
// training-session-live-screen.jsx (corredor), acá no hay navegación
// serie-a-serie: el entrenador es supervisor, ve el avance de otros.

const STATUS_META = {
  [PARTICIPANT_STATUS.NOT_JOINED]: { label: 'Sin unirse', bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-200' },
  [PARTICIPANT_STATUS.CONNECTED]: { label: 'En vivo', bg: 'bg-sky-200 dark:bg-sky-900', text: 'text-sky-800 dark:text-sky-200' },
  [PARTICIPANT_STATUS.IN_PROGRESS]: { label: 'En curso', bg: 'bg-primary', text: 'text-[#111518]' },
  [PARTICIPANT_STATUS.PAUSED]: { label: 'Pausado', bg: 'bg-amber-300', text: 'text-amber-950' },
  [PARTICIPANT_STATUS.COMPLETED]: { label: 'Completado', bg: 'bg-emerald-500', text: 'text-white' },
  [PARTICIPANT_STATUS.DISCONNECTED]: { label: 'Desconectado', bg: 'bg-slate-300 dark:bg-slate-600', text: 'text-slate-700 dark:text-slate-200' },
  [PARTICIPANT_STATUS.INTERRUPTED]: { label: 'Interrumpido', bg: 'bg-red-500', text: 'text-white' },
};

// `fitBounds(bounds, options)` -- el comentario de ejemplo de la librería
// (`@maplibre/maplibre-react-native/.../Camera.tsx`) muestra 3 argumentos
// posicionales (bounds, padding-objeto, duration-número), pero la firma REAL
// (confirmada en el mismo archivo, tanto en el tipo `CameraRef` como en la
// implementación de `useImperativeHandle`) solo acepta DOS: `bounds` y un
// único `options` donde `padding` va ANIDADO (`options.padding`, no
// `options.top/right/bottom/left` sueltos) y `duration` es una propiedad más
// de ese mismo objeto, no un tercer argumento. El código anterior pasaba
// `{top,right,bottom,left}` como si fuera el objeto `options` completo (sin
// el wrapper `padding:`) y `800`/`500` como 3er argumento -- la función real
// solo toma 2, así que ese valor se ignoraba en silencio. Resultado: NUNCA
// hubo padding real ni la duración pedida, desde el día 1 (bug real,
// 2026-10-03: "los iconos más externos quedan sobre los bordes del mapa").
const FIT_BOUNDS_OPTIONS = { padding: { top: 72, right: 72, bottom: 72, left: 72 }, duration: 600 };

// Subtítulo "Ejercicio · Serie N" -- solo tiene sentido mientras hay una serie
// en curso/pausada; el resto de los estados no tiene un "ahora mismo" que mostrar.
function currentActivityLabel(participant) {
  if (participant.status !== PARTICIPANT_STATUS.IN_PROGRESS && participant.status !== PARTICIPANT_STATUS.PAUSED) return null;
  if (!participant.currentExerciseName) return null;
  return participant.currentSetNumber != null
    ? `${participant.currentExerciseName} · Serie ${participant.currentSetNumber}`
    : participant.currentExerciseName;
}

const CONNECTION_META = {
  open: { label: 'En vivo', dot: 'bg-primary', text: 'text-emerald-700 dark:text-emerald-400' },
  connecting: { label: 'Conectando…', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400' },
  reconnecting: { label: 'Reconectando…', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400' },
  closed: { label: 'Sin conexión', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
};

function ConnectionBanner({ status }) {
  const meta = CONNECTION_META[status] ?? CONNECTION_META.closed;
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = status === 'open'
      ? withRepeat(withTiming(1.4, { duration: 700 }), -1, true)
      : withTiming(1, { duration: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View className="flex-row items-center gap-2 self-center rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800" nativeID="trainer-session-live-connection-banner" testID="trainer-session-live-connection-banner">
      <Animated.View className={`h-2 w-2 rounded-full ${meta.dot}`} nativeID="trainer-session-live-connection-dot" style={pulseStyle} testID="trainer-session-live-connection-dot" />
      <Text className={`text-xs font-semibold ${meta.text}`} nativeID="trainer-session-live-connection-label" testID="trainer-session-live-connection-label">{meta.label}</Text>
    </View>
  );
}

// Foto de perfil o iniciales, con un borde del color distintivo de ese
// usuario (colorForUserId/TRAINER_MARKER_COLOR) -- mismo componente para el
// marcador del mapa (corredor y entrenador) y reusable donde haga falta el
// mismo círculo. El color del borde es la señal de identidad consistente
// entre el mapa y el puntito de las listas de participantes.
// `Marker` en sí no expone un `onPress` propio en esta versión de
// @maplibre/maplibre-react-native -- pero su contenido es un árbol de vistas
// nativo normal, así que un `Pressable` adentro recibe el toque igual que en
// cualquier otro lugar de la app (mismo criterio ya usado en
// location-picker.jsx, que solo necesitaba mostrar el marcador y por eso
// nunca necesitó probar esto). `onSelect` es `setSelectedParticipantId` del
// componente padre.
function ParticipantMarker({ participant, onSelect }) {
  const pulse = useSharedValue(1);
  const isRecent = Date.now() - (participant.position.ts ?? 0) < 20000;
  const idPrefix = `trainer-session-live-marker-${participant.userId}`;

  useEffect(() => {
    if (isRecent) {
      pulse.value = withRepeat(withTiming(1.15, { duration: 700 }), -1, true);
    } else {
      pulse.value = withTiming(1, { duration: 300 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecent]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Marker anchor="center" key={participant.userId} lngLat={[participant.position.longitude, participant.position.latitude]}>
      <Animated.View nativeID={`${idPrefix}-pulse`} pointerEvents="box-none" style={pulseStyle} testID={`${idPrefix}-pulse`}>
        {/* Opacidad reducida (no color) para "sin novedades hace rato" -- el
            color del borde ya está ocupado comunicando DE QUIÉN es el punto,
            así que la frescura se señala aparte. */}
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full shadow-md"
          nativeID={idPrefix}
          onPress={() => onSelect(participant.userId)}
          style={{ opacity: isRecent ? 1 : 0.5 }}
          testID={idPrefix}
        >
          <ParticipantAvatar color={colorForUserId(participant.userId)} idPrefix={idPrefix} name={participant.name} photoUrl={participant.photoUrl} size={36} />
        </Pressable>
      </Animated.View>
    </Marker>
  );
}

// Marcador de la posición propia del entrenador -- mismo componente de avatar
// que los corredores (foto o iniciales), pero con TRAINER_MARKER_COLOR (un
// color reservado, nunca lo pisa el hash de colorForUserId) para que se
// distinga de un vistazo en el mapa sin importar qué color le haya tocado a
// cada corredor.
function SelfMarker({ position, name, photoUrl }) {
  // Anillo punteado girando sin parar, además del borde fijo de
  // ParticipantAvatar -- a pedido del usuario, para diferenciar al
  // entrenador de un corredor sin el pulso de "recencia" de ParticipantMarker
  // (que no aplica acá: no hace falta señalar antigüedad de la propia posición).
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 3000, easing: Easing.linear }), -1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Marker anchor="center" lngLat={[position.longitude, position.latitude]}>
      <View className="items-center justify-center" nativeID="trainer-session-live-self-marker" testID="trainer-session-live-self-marker">
        <Animated.View
          className="absolute h-12 w-12 rounded-full"
          nativeID="trainer-session-live-self-marker-ring"
          style={[{ borderWidth: 2, borderColor: TRAINER_MARKER_COLOR, borderStyle: 'dashed' }, ringStyle]}
          testID="trainer-session-live-self-marker-ring"
        />
        <ParticipantAvatar color={TRAINER_MARKER_COLOR} idPrefix="trainer-session-live-self-marker" name={name} photoUrl={photoUrl} size={36} />
      </View>
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
// mecanismo de gesto ya probado en dispositivo, no reinventado. Más chico que
// el original (THUMB_SIZE 64→48, track h-20→h-14) a pedido del usuario: acá
// es el ÚNICO control de la pantalla en vivo del entrenador (sin
// pausar/saltear series como el corredor), no necesita el mismo protagonismo.
// Gap 26: forwardRef + reset() imperativo -- si el entrenador desliza hasta
// el final pero cancela el modal de confirmación (corredores sin terminar),
// el thumb tiene que volver al inicio en vez de quedar trabado en "completó"
// sin haber finalizado de verdad.
const DragToFinishButton = forwardRef(function DragToFinishButton({ onTrigger, idPrefix, label }, ref) {
  const THUMB_SIZE = 48;
  const colors = DRAG_VARIANTS.finish;
  const translateX = useSharedValue(0);
  const widthSV = useSharedValue(120);
  const triggeredRef = useSharedValue(false);

  useImperativeHandle(ref, () => ({
    reset: () => {
      triggeredRef.value = false;
      translateX.value = withSpring(0, { damping: 14, stiffness: 200 });
    },
  }));

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
      {/* Sin flex-1: a diferencia de training-session-live-screen.jsx (donde
          este track comparte una fila con el botón de mantener-para-cancelar
          y flex-1 reparte el ANCHO disponible en ESA fila), acá es el único
          hijo de un contenedor en COLUMNA -- flex-1 ahí significa "ocupar
          el alto restante", y como ese contenedor es de alto automático
          (sin flex propio), Yoga lo termina colapsando a casi 0px (bug
          real, 2026-10-01: "el slider queda casi escondido"). El ancho
          completo ya sale gratis del stretch por default de los hijos de
          una columna, sin necesitar flex-1 para nada acá. */}
      <View
        className={`h-14 rounded-full border ${colors.trackBorder}`}
        nativeID={`${idPrefix}-drag-track`}
        onLayout={(event) => { widthSV.value = Math.round(event.nativeEvent.layout.width); }}
        testID={`${idPrefix}-drag-track`}
      >
        <Animated.View className={`absolute inset-y-0 left-0 rounded-full ${colors.fill}`} nativeID={`${idPrefix}-drag-fill`} style={fillStyle} testID={`${idPrefix}-drag-fill`} />
        <Animated.View className={`absolute left-0.5 top-1 h-12 w-12 items-center justify-center rounded-full ${colors.thumb}`} nativeID={`${idPrefix}-drag-thumb`} style={thumbStyle} testID={`${idPrefix}-drag-thumb`}>
          <MaterialCommunityIcons color={colors.iconColor} name="flag-checkered" size={18} />
        </Animated.View>
        <View className="absolute inset-0 items-center justify-center px-14" nativeID={`${idPrefix}-drag-content`} pointerEvents="none" testID={`${idPrefix}-drag-content`}>
          <Text className={`text-center text-xs font-bold uppercase tracking-wide ${colors.label}`} nativeID={`${idPrefix}-drag-label`} numberOfLines={1} testID={`${idPrefix}-drag-label`}>{label}</Text>
        </View>
      </View>
    </GestureDetector>
  );
});

// Participantes y registros pasaron de paneles inline a Modal (a pedido del
// usuario) -- y con el MISMO estilo full-screen que AttendanceSessionModal
// (pantalla completa, backdrop a la derecha, SafeAreaView adentro), no el
// card chico centrado que tenían al principio. El usuario pidió explícitamente
// uniformar los tres (asistencia/participantes/registros) y quedarse con "la
// opción más segura" -- el patrón de asistencia ya está probado y resuelve el
// respeto de la status bar en Android, así que es ese el que se replica acá en
// vez de inventar uno nuevo.
function ParticipantsListModal({ visible, onClose, participants, onSelectParticipant, trainerName, trainerPhotoUrl }) {
  const colors = useThemeColors();
  const idPrefix = 'trainer-session-live-participants-modal';
  const [query, setQuery] = useState('');
  // filterByName (misma util del pre-start) preserva el orden del array de
  // entrada por substring-filter -- como `participants` ya llega ordenado
  // alfabéticamente desde el padre, filtrar acá no lo desordena.
  const visibleParticipants = filterByName(participants, query);

  return (
    <Modal animationType="fade" nativeID={`${idPrefix}`} onRequestClose={onClose} testID={`${idPrefix}`} transparent visible={visible}>
      <Pressable className="flex-1 items-end bg-black/50" nativeID={`${idPrefix}-backdrop`} onPress={onClose} testID={`${idPrefix}-backdrop`}>
        <Pressable className="h-full w-full max-w-lg bg-white dark:bg-surface" nativeID={`${idPrefix}-card`} onPress={() => {}} testID={`${idPrefix}-card`}>
          <SafeAreaView className="flex-1 p-4" edges={['top', 'bottom']} nativeID={`${idPrefix}-card-safe-area`} testID={`${idPrefix}-card-safe-area`}>
            <View className="mb-3 flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>Participantes</Text>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" nativeID={`${idPrefix}-close-button`} onPress={onClose} testID={`${idPrefix}-close-button`}>
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
              </Pressable>
            </View>
            <TextInput
              className="mb-2 h-10 rounded-full border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              nativeID={`${idPrefix}-search`}
              onChangeText={setQuery}
              placeholder="Buscar participante"
              placeholderTextColor={colors.onSurfaceVariant}
              testID={`${idPrefix}-search`}
              value={query}
            />
            {trainerName && (
              <TrainerCard idPrefix={`${idPrefix}-trainer-card`} name={trainerName} photoUrl={trainerPhotoUrl} />
            )}
            <ScrollView className="mt-2" nativeID={`${idPrefix}-list`} testID={`${idPrefix}-list`}>
              {visibleParticipants.map((participant) => {
                const activity = currentActivityLabel(participant);
                return (
                  <Pressable
                    className="flex-row items-center justify-between gap-2 border-b border-slate-100 p-3 active:opacity-70 dark:border-slate-800"
                    key={participant.userId}
                    nativeID={`${idPrefix}-list-${participant.userId}`}
                    onPress={() => onSelectParticipant(participant.userId)}
                    testID={`${idPrefix}-list-${participant.userId}`}
                  >
                    <View className="flex-1 flex-row items-center gap-2" nativeID={`${idPrefix}-list-${participant.userId}-identity`} testID={`${idPrefix}-list-${participant.userId}-identity`}>
                      <View
                        className="h-2.5 w-2.5 rounded-full"
                        nativeID={`${idPrefix}-list-${participant.userId}-dot`}
                        style={{ backgroundColor: colorForUserId(participant.userId) }}
                        testID={`${idPrefix}-list-${participant.userId}-dot`}
                      />
                      <View className="flex-1" nativeID={`${idPrefix}-list-${participant.userId}-text`} testID={`${idPrefix}-list-${participant.userId}-text`}>
                        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-list-${participant.userId}-name`} numberOfLines={1} testID={`${idPrefix}-list-${participant.userId}-name`}>{participant.name}</Text>
                        {activity && (
                          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-list-${participant.userId}-activity`} numberOfLines={1} testID={`${idPrefix}-list-${participant.userId}-activity`}>{activity}</Text>
                        )}
                      </View>
                    </View>
                    <View className={`rounded-full px-2.5 py-1 ${STATUS_META[displayStatus(participant)].bg}`} nativeID={`${idPrefix}-list-${participant.userId}-status`} testID={`${idPrefix}-list-${participant.userId}-status`}>
                      <Text className={`text-[11px] font-semibold ${STATUS_META[displayStatus(participant)].text}`} nativeID={`${idPrefix}-list-${participant.userId}-status-label`} testID={`${idPrefix}-list-${participant.userId}-status-label`}>{STATUS_META[displayStatus(participant)].label}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {visibleParticipants.length === 0 && (
                <Text className="p-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-empty`} testID={`${idPrefix}-empty`}>
                  Sin coincidencias.
                </Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// "Ahora: Sentadillas · Serie 2" mientras hay una serie en curso/pausada;
// "Próximo: ..." (derivado de resolvedSetCount, ver nextExercise) el resto
// del tiempo, salvo que ya haya completado todo -- a pedido del usuario, el
// detalle de un participante que todavía no arrancó nada (CONNECTED) o que
// está entre series no se queda sin decir nada.
function activityOrNextLabel(participant, exercises) {
  // Gap 19: un estado terminal (completó o interrumpió) ya no tiene "ahora"
  // ni "próximo" que mostrar -- displayStatus ya cubre ambos casos arriba.
  const resolved = displayStatus(participant);
  if (resolved === PARTICIPANT_STATUS.COMPLETED || resolved === PARTICIPANT_STATUS.INTERRUPTED) return null;
  const current = currentActivityLabel(participant);
  if (current) return { prefix: 'Ahora', label: current };
  const next = nextExercise(exercises, participant.resolvedSetCount);
  if (!next) return null;
  return { prefix: 'Próximo', label: `${next.exerciseName} · Serie ${next.setNumber}` };
}

function ParticipantDetailModal({ participant, onClose, exercises, feed }) {
  const idPrefix = 'trainer-session-live-participant-detail';
  const activity = participant ? activityOrNextLabel(participant, exercises) : null;
  const ownRecords = participant ? filterFeedByAthlete(feed, participant.userId) : [];

  return (
    <Modal animationType="fade" nativeID={`${idPrefix}-modal`} onRequestClose={onClose} testID={`${idPrefix}-modal`} transparent visible={Boolean(participant)}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID={`${idPrefix}-backdrop`} onPress={onClose} testID={`${idPrefix}-backdrop`}>
        <Pressable className="max-h-[80%] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-surface" nativeID={`${idPrefix}-card`} onPress={() => {}} testID={`${idPrefix}-card`}>
          {participant && (
            <>
              <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-identity`} testID={`${idPrefix}-identity`}>
                <View
                  className="h-2.5 w-2.5 rounded-full"
                  nativeID={`${idPrefix}-dot`}
                  style={{ backgroundColor: colorForUserId(participant.userId) }}
                  testID={`${idPrefix}-dot`}
                />
                <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`}>{participant.name}</Text>
              </View>
              <View className="mt-3 flex-row items-center gap-2" nativeID={`${idPrefix}-status`} testID={`${idPrefix}-status`}>
                <View className={`rounded-full px-3 py-1 ${STATUS_META[displayStatus(participant)].bg}`} nativeID={`${idPrefix}-status-chip`} testID={`${idPrefix}-status-chip`}>
                  <Text className={`text-xs font-semibold ${STATUS_META[displayStatus(participant)].text}`} nativeID={`${idPrefix}-status-label`} testID={`${idPrefix}-status-label`}>{STATUS_META[displayStatus(participant)].label}</Text>
                </View>
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-sets`} testID={`${idPrefix}-sets`}>{participant.resolvedSetCount} serie(s) resueltas</Text>
              </View>
              {activity && (
                <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-activity`} testID={`${idPrefix}-activity`}>
                  {activity.prefix}: {activity.label}
                </Text>
              )}

              <Text className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-records-label`} testID={`${idPrefix}-records-label`}>
                Registros
              </Text>
              <ScrollView className="max-h-48" nativeID={`${idPrefix}-records-list`} testID={`${idPrefix}-records-list`}>
                {ownRecords.map((event) => (
                  <View className="border-b border-slate-100 py-2 dark:border-slate-800" key={event.id} nativeID={`${idPrefix}-records-item-${event.id}`} testID={`${idPrefix}-records-item-${event.id}`}>
                    <Text className="text-sm text-slate-900 dark:text-white" nativeID={`${idPrefix}-records-item-${event.id}-text`} testID={`${idPrefix}-records-item-${event.id}-text`}>
                      {event.exerciseName} · Serie {event.setNumber} · {event.status === 'skipped' ? 'Salteada' : 'Completada'}
                    </Text>
                  </View>
                ))}
                {ownRecords.length === 0 && (
                  <Text className="py-2 text-center text-sm text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-records-empty`} testID={`${idPrefix}-records-empty`}>
                    Sin registros todavía.
                  </Text>
                )}
              </ScrollView>
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

  const sessionInstanceId = pendingSession?.sessionInstance?.id;
  const exercises = pendingSession?.sessionInstance?.exercises ?? [];
  const teamId = pendingSession?.teamId ?? null;
  const groupId = pendingSession?.groupId ?? null;
  const { members: rosterMembers } = useTeamRoster(teamId, groupId ? [groupId] : []);

  const trainerUserId = useAuthStore((s) => s.userId);
  const { user: trainerUser } = useUser(trainerUserId);
  // El entrenador puede figurar en el roster del grupo -- no es un corredor
  // más, se supervisa aparte (SelfMarker en el mapa, TrainerCard en la
  // lista), nunca mezclado con la gente a la que está supervisando.
  const runnerMembers = rosterMembers.filter((m) => String(m.userId) !== String(trainerUserId));

  const { connectionStatus, participants, feed, selfPosition, finalize } = useTrainerSessionRuntime({ sessionInstanceId, exercises, rosterMembers: runnerMembers });

  const [participantsVisible, setParticipantsVisible] = useState(false);
  const [feedVisible, setFeedVisible] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);
  const [feedFilterAthleteId, setFeedFilterAthleteId] = useState(null);
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [attendanceVisible, setAttendanceVisible] = useState(false);
  const [finishConfirmVisible, setFinishConfirmVisible] = useState(false);
  const cameraRef = useRef(null);
  const dragRef = useRef(null);

  // Centro inicial del mapa: el punto de encuentro marcado para la sesión
  // presencial, no una zona fija arbitraria -- el auto-encuadre (efecto de
  // abajo) sigue ajustando a partir de acá a medida que se suman corredores.
  // Sin ubicación cargada, cae al mismo default de siempre.
  const meetingPoint = pendingSession?.presencialLocation;
  const initialCameraCenter = meetingPoint?.lng != null && meetingPoint?.lat != null
    ? [meetingPoint.lng, meetingPoint.lat]
    : [-58.4, -34.6];
  const initialCameraZoom = meetingPoint?.lng != null && meetingPoint?.lat != null ? 15 : 12;

  const participantList = useMemo(() => [...participants.values()].sort((a, b) => a.name.localeCompare(b.name)), [participants]);
  const positionedParticipants = useMemo(() => participantList.filter((p) => p.position), [participantList]);
  // Posición propia incluida en el cálculo de bounds (para que el auto-encuadre
  // no deje al entrenador afuera de cuadro), pero NO en las deps del efecto de
  // abajo -- el movimiento continuo del propio entrenador nunca debe disparar
  // un refit, solo la llegada de un corredor nuevo.
  const boundsPoints = useMemo(
    () => [...positionedParticipants.map((p) => p.position), ...(selfPosition ? [selfPosition] : [])],
    [positionedParticipants, selfPosition],
  );
  const bounds = useMemo(() => computeBounds(boundsPoints), [boundsPoints]);

  // Auto-encuadre SOLO cuando se suma un participante nuevo (el conteo sube),
  // no en cada movimiento -- clave en las deps es positionedParticipants.length,
  // no el array completo, así que actualizar la posición de alguien ya
  // conocido no vuelve a disparar el fitBounds.
  useEffect(() => {
    if (bounds) cameraRef.current?.fitBounds(bounds, FIT_BOUNDS_OPTIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionedParticipants.length]);

  const selectedParticipant = participantList.find((p) => p.userId === selectedParticipantId) ?? null;
  const visibleFeed = filterFeedByAthlete(feed, feedFilterAthleteId);
  const feedOptions = runnerMembers.map((m) => ({ id: m.userId, name: m.name }));
  const unfinished = useMemo(() => unfinishedParticipants(participants), [participants]);

  useEffect(() => {
    if (finishConfirmVisible) notifyWarning();
  }, [finishConfirmVisible]);

  const handleFinish = async () => {
    await finalize();
    notifySuccess();
    // Al resumen post-sesión, no de vuelta al pre-start -- mismo criterio que
    // la pantalla del corredor (badge + registro), acá a nivel de TODA la
    // sesión. `pendingSession` sigue vivo (no se limpia acá) porque esa
    // pantalla lo necesita; ella misma lo limpia al salir.
    router.push('/trainer-session-review');
  };

  // El slide-to-finish SIEMPRE confirma, haya o no corredores sin terminar --
  // mismo criterio de seguridad que el mantener-presionado del corredor para
  // cancelar (un gesto de una sola dirección en una pantalla con mapa no es
  // garantía de intención, a diferencia de un deslizar explícito con feedback
  // visual -- igual se pide confirmación explícita antes de un cierre que
  // afecta a todos). El mensaje varía según haya o no corredores sin terminar.
  const handleFinishTrigger = () => {
    setFinishConfirmVisible(true);
  };

  const handleCancelFinishConfirm = () => {
    setFinishConfirmVisible(false);
    dragRef.current?.reset();
  };

  const handleConfirmFinishAnyway = () => {
    setFinishConfirmVisible(false);
    handleFinish();
  };

  if (!pendingSession) return null;

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="trainer-session-live-root" testID="trainer-session-live-root">
      <View className="flex-row items-center justify-between px-4 py-2" nativeID="trainer-session-live-banner-container" testID="trainer-session-live-banner-container">
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
          nativeID="trainer-session-live-back-button"
          onPress={() => router.back()}
          testID="trainer-session-live-back-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={20} />
        </Pressable>
        <View className="flex-1 items-center" nativeID="trainer-session-live-banner-center" testID="trainer-session-live-banner-center">
          {connectionStatus && <ConnectionBanner status={connectionStatus} />}
        </View>
        <View className="w-9" nativeID="trainer-session-live-banner-spacer" testID="trainer-session-live-banner-spacer" />
      </View>

      <View className="flex-1 overflow-hidden" nativeID="trainer-session-live-map-container" testID="trainer-session-live-map-container">
        <Map mapStyle={OPENFREEMAP_MINIMAL_STYLE_URL} nativeID="trainer-session-live-map" style={{ flex: 1 }} testID="trainer-session-live-map">
          {/* maxZoom frena el "fit all points" cuando los puntos coinciden
              casi exactamente (ej. solo el entrenador conectado, sin ningún
              corredor todavía) -- sin esto, fitBounds sobre una caja de área
              casi nula pide el zoom más cercano posible (bug real reportado,
              2026-10-01: "zoom insano"). */}
          <Camera initialViewState={{ center: initialCameraCenter, zoom: initialCameraZoom }} maxZoom={17} ref={cameraRef} />
          {positionedParticipants.map((participant) => (
            <ParticipantMarker key={participant.userId} onSelect={setSelectedParticipantId} participant={participant} />
          ))}
          {selfPosition && <SelfMarker name={trainerUser?.name} photoUrl={trainerUser?.photoUrl} position={selfPosition} />}
        </Map>
        <View className="absolute right-3 top-3 gap-2" nativeID="trainer-session-live-map-buttons" testID="trainer-session-live-map-buttons">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
            nativeID="trainer-session-live-fullscreen-button"
            onPress={() => setFullscreenMap((v) => !v)}
            testID="trainer-session-live-fullscreen-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name={fullscreenMap ? 'fullscreen-exit' : 'fullscreen'} size={22} />
          </Pressable>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
            nativeID="trainer-session-live-recenter-button"
            onPress={() => cameraRef.current?.flyTo({ center: initialCameraCenter, duration: 500 })}
            testID="trainer-session-live-recenter-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-radius-outline" size={22} />
          </Pressable>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
            nativeID="trainer-session-live-fit-all-button"
            onPress={() => { if (bounds) cameraRef.current?.fitBounds(bounds, FIT_BOUNDS_OPTIONS); }}
            testID="trainer-session-live-fit-all-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="fit-to-page-outline" size={22} />
          </Pressable>
        </View>
      </View>

      {!fullscreenMap && (
        <View className="gap-3 p-4" nativeID="trainer-session-live-controls" testID="trainer-session-live-controls">
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
              onPress={() => setParticipantsVisible(true)}
              testID="trainer-session-live-participants-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-group-outline" size={18} />
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-live-participants-button-label" testID="trainer-session-live-participants-button-label">Participantes</Text>
            </Pressable>
          </View>

          <Pressable
            className="h-11 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700"
            nativeID="trainer-session-live-feed-button"
            onPress={() => setFeedVisible(true)}
            testID="trainer-session-live-feed-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clipboard-text-clock-outline" size={18} />
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-live-feed-button-label" testID="trainer-session-live-feed-button-label">Ver registros</Text>
          </Pressable>

          <DragToFinishButton idPrefix="trainer-session-live-finish" label="Deslizá para finalizar la sesión" onTrigger={handleFinishTrigger} ref={dragRef} />
        </View>
      )}

      <ParticipantsListModal
        onClose={() => setParticipantsVisible(false)}
        onSelectParticipant={setSelectedParticipantId}
        participants={participantList}
        trainerName={trainerUser?.name}
        trainerPhotoUrl={trainerUser?.photoUrl}
        visible={participantsVisible}
      />

      <RecordsFeedModal
        feed={visibleFeed}
        feedFilterAthleteId={feedFilterAthleteId}
        feedOptions={feedOptions}
        idPrefix="trainer-session-live-feed-modal"
        onChangeFeedFilter={setFeedFilterAthleteId}
        onClose={() => setFeedVisible(false)}
        visible={feedVisible}
      />

      <ParticipantDetailModal exercises={exercises} feed={feed} onClose={() => setSelectedParticipantId(null)} participant={selectedParticipant} />

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

      <ConfirmDestructiveModal
        confirmLabel={unfinished.length > 0 ? 'Finalizar igual' : 'Finalizar sesión'}
        description={
          unfinished.length > 0
            ? `Todavía hay ${unfinished.length} corredor${unfinished.length === 1 ? '' : 'es'} que no completó su sesión: ${unfinished.map((p) => p.name).join(', ')}. Al finalizar se cierra la sesión para TODOS los corredores -- quedan registrados hasta donde llegaron, el resto sin registro. ¿Finalizar igual?`
            : 'Se va a cerrar la sesión para todos los corredores. ¿Confirmás finalizar?'
        }
        idPrefix="trainer-session-live-finish-confirm"
        onCancel={handleCancelFinishConfirm}
        onConfirm={handleConfirmFinishAnyway}
        title={unfinished.length > 0 ? 'Finalizar con corredores sin terminar' : 'Finalizar la sesión'}
        visible={finishConfirmVisible}
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

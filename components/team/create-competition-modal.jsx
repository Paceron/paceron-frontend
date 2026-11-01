import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { InputField, DateField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { METRIC_OPTIONS } from '../../utils/gamification-metric-options.js';
import { RouteDrawPicker } from './route-draw-picker';
import { toISODate } from '../../utils/date-field-format.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';

// Alta de competencia (Gap 33, tipo 'metric' únicamente -- 'route' es
// Spec 4b). El checklist de participantes ya viene filtrado (sin el
// entrenador) por el caller -- el backend lo rechaza igual si llegara,
// pero no se lo ofrece desde el vamos. Sin campo de nombre a propósito --
// confirmado 2026-10-14 que el backend todavía no tiene esa columna
// (decisión D8); el título de cada fila se arma solo (ver
// utils/competition-title.js).
const TYPE_OPTIONS = [
  { id: 'metric', name: 'Por métrica' },
  { id: 'route', name: 'Por trayectoria' },
];
const DEFAULT_ACCEPTANCE_RADIUS = 50;

export function CreateCompetitionModal({ visible, onClose, onSubmit, members, groups }) {
  const colors = useThemeColors();
  // Causa real confirmada 2026-10-17 con logs reales de Expo Go (ver
  // create-session-modal.jsx:349-366, MISMO bug ya documentado ahí
  // 2026-09-14 -- debería haberse copiado el fix completo de entrada, no
  // solo la mitad): `maxHeight` SIN `height` explícito dejaba el card con
  // tamaño intrínseco (a su contenido) en Yoga nativo -- el ScrollView
  // `flex-1` de adentro no tenía a qué alto crecer y colapsaba a 0 (card
  // onLayout medía 129px pese a maxHeight=751; scroll onLayout medía
  // 0 de alto). Web tolera ese mismo layout sin colapsar por diferencias
  // del algoritmo flexbox del browser vs Yoga -- por eso nunca se notó
  // ahí (confirmado roto solo en mobile, con logs). Fix: `height` fijo
  // IGUAL a `maxHeight`, no una alternativa -- las dos juntas, mismo
  // patrón ya probado en create-session-modal.jsx.
  const { height: windowHeight } = useWindowDimensions();
  const modalHeight = windowHeight * 0.9;

  const [type, setType] = useState('metric');
  const [metric, setMetric] = useState('distance');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [route, setRoute] = useState(null);
  const [acceptanceRadius, setAcceptanceRadius] = useState(String(DEFAULT_ACCEPTANCE_RADIUS));
  // Vacío por default -- Gap 36, confirmado por backend 2026-10-23: dato
  // extra, no requerido. Vacío = sin límite (no un número por default).
  const [maxAttempts, setMaxAttempts] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Pan/pinch-zoom del mapa de RouteDrawPicker no respondían (confirmado
  // con logs reales, 2026-10-18): MapLibre SÍ recibía el gesto
  // (onRegionIsChanging disparaba, zoom cambiaba) pero el ScrollView de
  // este modal lo interrumpía a mitad de camino (onScrollBeginDrag
  // disparaba, el mapa cortaba con onRegionDidChange) -- MapLibre maneja
  // sus gestos en su propio hilo nativo, fuera del sistema de responder
  // de RN, así que no hay prop del `Map` que evite que el ScrollView
  // ANCESTRO lo intercepte vía onInterceptTouchEvent de Android. Mismo
  // workaround que usa react-native-maps para este caso: apagar
  // `scrollEnabled` del ScrollView mientras el dedo está sobre el mapa,
  // para que no compita por el gesto en absoluto.
  const [mapInteracting, setMapInteracting] = useState(false);

  const resetKey = String(visible);
  const prevResetKeyRef = useRef(null);
  const isResetting = visible && resetKey !== prevResetKeyRef.current;

  if (isResetting) {
    prevResetKeyRef.current = resetKey;
    setType('metric');
    setMetric('distance');
    setStartDate('');
    setEndDate('');
    setRoute(null);
    setAcceptanceRadius(String(DEFAULT_ACCEPTANCE_RADIUS));
    setMaxAttempts('');
    setGroupFilter('');
    setSelectedIds([]);
    setError(null);
  } else if (!visible) {
    prevResetKeyRef.current = null;
  }

  const dirtyValues = isResetting ? { selectedIds: [] } : { selectedIds };
  const formDirty = useFormDirty(dirtyValues, 'new');
  const isDirty = visible && formDirty;
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  const handleClose = () => {
    if (__DEV__) console.log('[GESTURE-DEBUG create-competition-modal] handleClose (backdrop onPress o back nativo)', { t: Date.now() });
    if (submitting) return;
    guardedClose(onClose);
  };

  const visibleMembers = groupFilter ? members.filter((m) => m.groupId === groupFilter) : members;

  const toggleMember = (userId) => {
    setSelectedIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!startDate || (type === 'metric' && !endDate)) {
      setError(type === 'metric' ? 'Elegí la fecha de inicio y de fin.' : 'Elegí la fecha de inicio.');
      return;
    }
    const startIso = toISODate(startDate);
    let endIso = null;
    if (type === 'metric') {
      endIso = toISODate(endDate);
      if (!(endIso > startIso)) {
        setError('La fecha de fin tiene que ser posterior a la de inicio.');
        return;
      }
    } else {
      if (!route || route.coordinates.length < 2) {
        setError('Dibujá una ruta de al menos 2 puntos en el mapa.');
        return;
      }
      const radius = Number(acceptanceRadius);
      if (!Number.isFinite(radius) || radius < 5 || radius > 500) {
        setError('El radio de aceptación tiene que estar entre 5 y 500 metros.');
        return;
      }
      // Opcional -- vacío es válido (sin límite). Solo valida si trae algo.
      // Sin tope superior -- confirmado por backend 2026-10-23: entero ≥1,
      // sin máximo.
      if (maxAttempts) {
        const attempts = Number(maxAttempts);
        if (!Number.isInteger(attempts) || attempts < 1) {
          setError('El máximo de intentos tiene que ser un número entero mayor o igual a 1.');
          return;
        }
      }
    }
    if (selectedIds.length < 2) {
      setError('Elegí al menos 2 participantes.');
      return;
    }

    setSubmitting(true);
    const result = await onSubmit({
      type,
      startAt: startIso,
      ...(type === 'metric'
        ? { metric, endAt: endIso }
        : { route, acceptanceRadiusMeters: Number(acceptanceRadius), maxAttempts: maxAttempts || null }),
      participantUserIds: selectedIds,
      groupId: groupFilter || null,
    });
    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <>
      <Modal animationType="fade" nativeID="create-competition-modal" onRequestClose={handleClose} testID="create-competition-modal" transparent visible={visible}>
        {/* Backdrop y card como HERMANOS, no backdrop envolviendo card --
            MISMO bug y MISMO fix ya documentados en
            session-messages-modal.jsx (2026-10-09, ver CLAUDE.md sección
            "Modales"). Causa real confirmada con los logs de touch de
            2026-10-17: con el card (Pressable no-op) como HIJO del
            backdrop, un touch con un SEGUNDO dedo apoyado (ej. pinch sobre
            el mapa, que vive adentro de la ScrollView del card) terminaba
            resolviéndose como un tap sobre el BACKDROP al soltar -- el log
            mostró handleClose disparando ~325ms después de dos
            onTouchStart superpuestos sobre el mapa, cerrando el modal en
            medio de un pinch. Con hermanos + posición absoluta, un touch
            sobre el card nunca llega al backdrop (gana por z-order
            nativo) -- no hay ningún Pressable intermedio reclamando
            responder que pueda confundirse con un segundo dedo. */}
        <View className="flex-1" nativeID="create-competition-modal-overlay" testID="create-competition-modal-overlay">
          <Pressable
            className="absolute inset-0 bg-black/50"
            nativeID="create-competition-modal-backdrop"
            onPress={handleClose}
            onTouchEnd={() => { if (__DEV__) console.log('[GESTURE-DEBUG create-competition-modal] backdrop onTouchEnd', { t: Date.now() }); }}
            onTouchStart={() => { if (__DEV__) console.log('[GESTURE-DEBUG create-competition-modal] backdrop onTouchStart', { t: Date.now() }); }}
            testID="create-competition-modal-backdrop"
          />
          <View className="absolute inset-0 items-center justify-center px-4" nativeID="create-competition-modal-card-wrap" pointerEvents="box-none" testID="create-competition-modal-card-wrap">
          <View
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface"
            nativeID="create-competition-modal-card"
            onTouchEnd={() => { if (__DEV__) console.log('[GESTURE-DEBUG create-competition-modal] card onTouchEnd', { t: Date.now() }); }}
            onTouchStart={() => { if (__DEV__) console.log('[GESTURE-DEBUG create-competition-modal] card onTouchStart', { t: Date.now() }); }}
            style={{ height: modalHeight, maxHeight: modalHeight }}
            testID="create-competition-modal-card"
          >
            <View className="mb-4 shrink-0 flex-row items-center gap-2" nativeID="create-competition-modal-header" testID="create-competition-modal-header">
              <MaterialCommunityIcons color={colors.primary} name="sword-cross" size={20} />
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="create-competition-modal-title" testID="create-competition-modal-title">
                Nueva competencia
              </Text>
            </View>

            {/* El teclado en pantalla (mobile) tapaba los campos del final
                del form (ej. "Máximo de intentos") mientras se escribía --
                bug real reportado 2026-10-29. `behavior="height"` en
                Android achica el alto disponible de este wrapper cuando
                aparece el teclado, dándole al ScrollView de adentro un
                `flex-1` más chico (no tapado); en iOS, `"padding"` agrega
                el padding inferior equivalente. Mismo patrón ya usado en
                location-picker.jsx. */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            {/* `flex-1` -- la card entera tiene `height` FIJO (no solo
                `maxHeight`, ver el comentario de arriba): sin un `height`
                explícito, Yoga nativo no le da a este ScrollView ningún
                alto concreto para crecer y colapsa a 0. */}
            <ScrollView
              className="flex-1"
              nativeID="create-competition-modal-scroll"
              onMomentumScrollBegin={() => { if (__DEV__) console.log('[GESTURE-DEBUG create-competition-modal] scroll onMomentumScrollBegin', { t: Date.now() }); }}
              onMomentumScrollEnd={() => { if (__DEV__) console.log('[GESTURE-DEBUG create-competition-modal] scroll onMomentumScrollEnd', { t: Date.now() }); }}
              onScrollBeginDrag={() => { if (__DEV__) console.log('[GESTURE-DEBUG create-competition-modal] scroll onScrollBeginDrag (ganó el responder de scroll)', { t: Date.now() }); }}
              onScrollEndDrag={() => { if (__DEV__) console.log('[GESTURE-DEBUG create-competition-modal] scroll onScrollEndDrag', { t: Date.now() }); }}
              onTouchStart={() => { if (__DEV__) console.log('[GESTURE-DEBUG create-competition-modal] scroll onTouchStart', { t: Date.now() }); }}
              scrollEnabled={!mapInteracting}
              testID="create-competition-modal-scroll"
            >
              <View className="gap-3" nativeID="create-competition-modal-fields" testID="create-competition-modal-fields">
                <ResponsiveSelectField dense hideErrorRow label="Tipo de competencia" onChange={setType} options={TYPE_OPTIONS} required value={type} />

                {type === 'metric' ? (
                  <>
                    <ResponsiveSelectField dense hideErrorRow label="Métrica" onChange={setMetric} options={METRIC_OPTIONS} required value={metric} />
                    {/* Fila SIEMPRE (no solo web, a diferencia de Row/Col) --
                        pedido real: ahorrar espacio también en mobile para
                        este par puntual. `dense` achica cada DateField para
                        que los dos entren en una fila angosta. */}
                    <View className="flex-row gap-3" nativeID="create-competition-modal-dates-row" testID="create-competition-modal-dates-row">
                      <View className="flex-1" nativeID="create-competition-modal-dates-from-wrap" testID="create-competition-modal-dates-from-wrap">
                        <DateField dense disableFutureLimit hideErrorRow label="Desde" onChange={setStartDate} value={startDate} />
                      </View>
                      <View className="flex-1" nativeID="create-competition-modal-dates-to-wrap" testID="create-competition-modal-dates-to-wrap">
                        <DateField dense disableFutureLimit hideErrorRow label="Hasta" onChange={setEndDate} value={endDate} />
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <DateField dense disableFutureLimit hideErrorRow label="Desde" onChange={setStartDate} value={startDate} />
                    <RouteDrawPicker acceptanceRadiusMeters={Number(acceptanceRadius)} onChange={setRoute} onMapTouchEnd={() => setMapInteracting(false)} onMapTouchStart={() => setMapInteracting(true)} value={route} />
                    <InputField className="mb-0" dense hideErrorRow keyboardType="numeric" label="Radio de aceptación (metros)" onChange={setAcceptanceRadius} value={acceptanceRadius} />
                    <InputField className="mb-0" dense hideErrorRow keyboardType="numeric" label="Máximo de intentos por corredor (opcional)" onChange={setMaxAttempts} placeholder="Sin límite" value={maxAttempts} />
                  </>
                )}

                {groups.length > 0 && (
                  <ResponsiveSelectField
                    dense
                    hideErrorRow
                    label="Acotar a un grupo (opcional)"
                    onChange={setGroupFilter}
                    options={groups}
                    placeholder="Todos los grupos"
                    value={groupFilter}
                  />
                )}

                <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="create-competition-modal-participants-label" testID="create-competition-modal-participants-label">
                  Participantes ({selectedIds.length})
                </Text>
                <View className="gap-1" nativeID="create-competition-modal-participants-list" testID="create-competition-modal-participants-list">
                  {visibleMembers.map((member) => {
                    const checked = selectedIds.includes(member.userId);
                    return (
                      <Pressable
                        className="flex-row items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
                        key={member.userId}
                        nativeID={`create-competition-modal-member-${member.userId}`}
                        onPress={() => toggleMember(member.userId)}
                        testID={`create-competition-modal-member-${member.userId}`}
                      >
                        <MaterialCommunityIcons color={checked ? colors.primary : colors.onSurfaceVariant} name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={18} />
                        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`create-competition-modal-member-${member.userId}-name`} testID={`create-competition-modal-member-${member.userId}-name`}>
                          {member.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Movido al fondo, pegado a las acciones -- pedido real,
                2026-10-15: "mueve el espacio reservado a errores abajo de
                todo del form por encima de los botones de cancelar/crear". */}
            {error && (
              <Text className="mt-3 shrink-0 text-xs text-red-600 dark:text-red-400" nativeID="create-competition-modal-error" testID="create-competition-modal-error">
                {error}
              </Text>
            )}

            <View className="mt-3 shrink-0 flex-row gap-3" nativeID="create-competition-modal-actions" testID="create-competition-modal-actions">
              <Pressable
                className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                disabled={submitting}
                nativeID="create-competition-modal-cancel-button"
                onPress={handleClose}
                testID="create-competition-modal-cancel-button"
              >
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="create-competition-modal-cancel-label" testID="create-competition-modal-cancel-label">Cancelar</Text>
              </Pressable>
              <Pressable
                className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80"
                disabled={submitting}
                nativeID="create-competition-modal-confirm-button"
                onPress={handleSubmit}
                testID="create-competition-modal-confirm-button"
              >
                {submitting ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-competition-modal-confirm-label" testID="create-competition-modal-confirm-label">
                    Crear
                  </Text>
                )}
              </Pressable>
            </View>
            </KeyboardAvoidingView>
          </View>
          </View>
        </View>
      </Modal>
      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}

import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { InputField, Row, Col, DateField } from '../forms/fields.jsx';
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

  const [type, setType] = useState('metric');
  const [metric, setMetric] = useState('distance');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [route, setRoute] = useState(null);
  const [acceptanceRadius, setAcceptanceRadius] = useState(String(DEFAULT_ACCEPTANCE_RADIUS));
  const [groupFilter, setGroupFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
        : { route, acceptanceRadiusMeters: Number(acceptanceRadius) }),
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
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="create-competition-modal-backdrop" onPress={handleClose} testID="create-competition-modal-backdrop">
          <Pressable className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="create-competition-modal-card" onPress={() => {}} testID="create-competition-modal-card">
            <View className="mb-4 flex-row items-center gap-2" nativeID="create-competition-modal-header" testID="create-competition-modal-header">
              <MaterialCommunityIcons color={colors.primary} name="sword-cross" size={20} />
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="create-competition-modal-title" testID="create-competition-modal-title">
                Nueva competencia
              </Text>
            </View>

            {error && (
              <Text className="mb-2 text-xs text-red-600 dark:text-red-400" nativeID="create-competition-modal-error" testID="create-competition-modal-error">
                {error}
              </Text>
            )}

            <ScrollView className="max-h-[70vh]" nativeID="create-competition-modal-scroll" testID="create-competition-modal-scroll">
              <View className="gap-3" nativeID="create-competition-modal-fields" testID="create-competition-modal-fields">
                <ResponsiveSelectField dense label="Tipo de competencia" onChange={setType} options={TYPE_OPTIONS} value={type} />

                {type === 'metric' ? (
                  <>
                    <ResponsiveSelectField dense label="Métrica" onChange={setMetric} options={METRIC_OPTIONS} value={metric} />
                    <Row>
                      <Col>
                        <DateField label="Desde" onChange={setStartDate} value={startDate} />
                      </Col>
                      <Col>
                        <DateField label="Hasta" onChange={setEndDate} value={endDate} />
                      </Col>
                    </Row>
                  </>
                ) : (
                  <>
                    <DateField label="Desde" onChange={setStartDate} value={startDate} />
                    <RouteDrawPicker onChange={setRoute} value={route} />
                    <InputField className="mb-0" dense keyboardType="numeric" label="Radio de aceptación (metros)" onChange={setAcceptanceRadius} value={acceptanceRadius} />
                  </>
                )}

                {groups.length > 0 && (
                  <ResponsiveSelectField
                    dense
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

            <View className="mt-3 flex-row gap-3" nativeID="create-competition-modal-actions" testID="create-competition-modal-actions">
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
          </Pressable>
        </Pressable>
      </Modal>
      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}

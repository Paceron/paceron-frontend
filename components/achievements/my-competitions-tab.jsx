import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';
import { useMyCompetitions } from '../../hooks/use-my-competitions.js';
import { useMyMemberTeams } from '../../hooks/use-teams.js';
import { sortCompetitionsForList } from '../../utils/competition-sort.js';
import { filterCompetitionsByFields, splitByLifecycle } from '../../utils/competition-filters.js';
import { buildCompetitionTitle } from '../../utils/competition-title.js';
import { useThemeColors } from '../../theme/colors.js';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { FilterableSubtabs } from '../shared/filterable-subtabs.jsx';

// Mismo par de tonos fijo por color que el resto de la app (ver
// docs/superpowers/specs/2026-10-31-visual-design-refresh-design.md,
// sección "Badges"), no se reusa ComplianceBadge -- ese toma un `pct`
// numérico, no un status de competencia.
const STATUS_TONE = {
  active: { label: 'Activa', bg: 'bg-primary-tint-subtle dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  pending_approval: { label: 'Pendiente', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
  finished: { label: 'Finalizada', bg: 'bg-slate-100 dark:bg-surface-2', text: 'text-slate-600 dark:text-slate-300' },
  rejected: { label: 'Rechazada', bg: 'bg-slate-100 dark:bg-surface-2', text: 'text-slate-600 dark:text-slate-300' },
};

function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.finished;
  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${tone.bg}`} nativeID={`my-competitions-tab-status-${status}`} testID={`my-competitions-tab-status-${status}`}>
      <Text className={`text-xs font-bold ${tone.text}`} nativeID={`my-competitions-tab-status-${status}-label`} testID={`my-competitions-tab-status-${status}-label`}>{tone.label}</Text>
    </View>
  );
}

function CompetitionRow({ competition, onPress }) {
  const colors = useThemeColors();
  const idPrefix = `my-competitions-tab-row-${competition.id}`;
  return (
    <View className="m-2 flex-row items-center justify-center gap-3 rounded-xl bg-slate-200/50 p-4 dark:bg-slate-800/60" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-1" nativeID={`${idPrefix}-text`} testID={`${idPrefix}-text`}>
        <Text className="font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} numberOfLines={3} testID={`${idPrefix}-title`}>
          {buildCompetitionTitle(competition)}
        </Text>
        <View className="flex-row items-center mt-2 gap-4" nativeID={`${idPrefix}-meta`} testID={`${idPrefix}-meta`}>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-team`} numberOfLines={1} testID={`${idPrefix}-team`}>
            {competition.teamName}
          </Text>
          <StatusBadge status={competition.status} />
        </View>
      </View>
      <Pressable
        accessibilityLabel={`Ver ${buildCompetitionTitle(competition)} en el equipo`}
        accessibilityRole="button"
        className="flex-row items-center rounded-full p-2 pl-4 bg-slate-50 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-surface-3"
        nativeID={`${idPrefix}-cta`}
        onPress={onPress}
        testID={`${idPrefix}-cta`}
      >
        <Text className="text-xs font-bold text-slate-900 dark:text-slate-300" nativeID={`${idPrefix}-cta-label`} testID={`${idPrefix}-cta-label`}>Ver en el equipo</Text>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={18} />
      </Pressable>
    </View>
  );
}

const SUBTABS = [
  { id: 'active_tab', icon: 'sword-cross', label: 'Activas' },
  { id: 'history_tab', icon: 'archive-outline', label: 'Historial' },
];

const EMPTY_MESSAGE = {
  active_tab: 'Todavía no participás de ninguna competencia activa.',
  history_tab: 'Todavía no tenés competencias en tu historial.',
};

export function MyCompetitionsTab() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const { teams } = useMyMemberTeams(userId);
  const { competitions, loading } = useMyCompetitions(userId);
  const [subTab, setSubTab] = useState('active_tab');
  const [filterTeamId, setFilterTeamId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const filterCount = [filterTeamId, filterType, filterFrom, filterTo].filter(Boolean).length;

  if (loading) return null;

  const filtered = filterCompetitionsByFields(competitions, { teamId: filterTeamId, type: filterType, from: filterFrom, to: filterTo });
  const { active, history } = splitByLifecycle(filtered);
  const visibleList = sortCompetitionsForList(subTab === 'active_tab' ? active : history);
  const teamOptions = teams.map((t) => ({ id: t.id, name: t.name }));

  return (
    <View nativeID="my-competitions-tab-root" testID="my-competitions-tab-root">
      <FilterableSubtabs
        active={subTab}
        filterContent={(
          <>
            <ResponsiveSelectField dense hideErrorRow label="Equipo" onChange={setFilterTeamId} options={teamOptions} placeholder="Todos los equipos" value={filterTeamId} />
            <ResponsiveSelectField dense hideErrorRow label="Tipo" onChange={setFilterType} options={[{ id: 'metric', name: 'Por métrica' }, { id: 'route', name: 'Por trayectoria' }]} placeholder="Todos los tipos" value={filterType} />
            <View className="mt-2 flex-row gap-3" nativeID="my-competitions-tab-date-range" testID="my-competitions-tab-date-range">
              <View className="flex-1" nativeID="my-competitions-tab-date-from" testID="my-competitions-tab-date-from">
                <DateField className="mb-0" dense hideErrorRow label="Desde" onChange={setFilterFrom} value={filterFrom} />
              </View>
              <View className="flex-1" nativeID="my-competitions-tab-date-to" testID="my-competitions-tab-date-to">
                <DateField className="mb-0" dense hideErrorRow label="Hasta" onChange={setFilterTo} value={filterTo} />
              </View>
            </View>
          </>
        )}
        filterCount={filterCount}
        onChange={setSubTab}
        scope="my-competitions-tab-subtabs"
        tabs={SUBTABS}
      />
      {visibleList.length === 0 ? (
        <Text className="py-6 text-center text-sm text-slate-400 dark:text-slate-500" nativeID="my-competitions-tab-empty" testID="my-competitions-tab-empty">
          {EMPTY_MESSAGE[subTab]}
        </Text>
      ) : (
        visibleList.map((competition) => (
          <CompetitionRow
            competition={competition}
            key={competition.id}
            onPress={() => router.push(`/teams/${competition.teamId}?tab=competencias`)}
          />
        ))
      )}
    </View>
  );
}

import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useTeamStore, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
import { getCountryName, getProvinceName } from '../../data/locations.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField, PickerField, Row, Col } from '../forms/fields.jsx';

const LEVEL_LABELS = { amateur: 'Amateur', 'semi-profesional': 'Semi-profesional', profesional: 'Profesional' };

// Mismos 3 estados que ya prevé "Sistema de suscripciones y cobros" en
// FUNCTIONAL_PROPOSE.md — dominio todavía no implementado, colores igual
// que STATUS_META en profile-screen.jsx para no inventar una paleta nueva.
const SUBSCRIPTION_META = {
  activo: { label: 'Activo', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  vencido: { label: 'Vencido', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  en_prueba: { label: 'En prueba', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
};

const TEAM_STATUS_META = {
  activo: { label: 'Activo', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  inactivo: { label: 'Inactivo', bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300' },
};

const PERIOD_OPTIONS = [
  { id: 'semana', name: 'Última semana' },
  { id: 'mes', name: 'Último mes' },
  { id: 'todo', name: 'Todo' },
];

// Sin dominio de entrenamientos/actividades todavía (ver FUNCTIONAL_PROPOSE.md,
// "Planificación de entrenamientos" y "Registro y seguimiento de actividades"
// siguen siendo módulos reservados) — valores mock deterministicos por período.
const MOCK_METRICS_BY_PERIOD = {
  semana: { trainingsCompleted: 12, goalsCompleted: 5 },
  mes: { trainingsCompleted: 48, goalsCompleted: 21 },
  todo: { trainingsCompleted: 210, goalsCompleted: 96 },
};

// Pestañas — solo en web (isWeb más abajo). En mobile las 3 secciones van
// apiladas en una sola pantalla, sin navegación por pestañas.
const TABS = [
  { id: 'general', label: 'Información general y estadísticas', icon: 'information-outline' },
  { id: 'corredores', label: 'Corredores', icon: 'account-multiple' },
  { id: 'grupos', label: 'Grupos', icon: 'account-group' },
];

const DASH = '—';
function display(value) {
  return value && String(value).trim() ? String(value) : DASH;
}

function Tag({ label, bg, text, nativeID, testID }) {
  return (
    <View className={`rounded-full px-2.5 py-1 ${bg}`} nativeID={nativeID} testID={testID}>
      <Text className={`text-xs font-semibold ${text}`} nativeID={`${nativeID}-label`} testID={`${testID}-label`}>{label}</Text>
    </View>
  );
}

function StatTile({ icon, label, value, colors }) {
  return (
    <View
      className="flex-1 items-center rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface"
      nativeID={`team-detail-stat-${label}`}
      testID={`team-detail-stat-${label}`}
    >
      <MaterialCommunityIcons color={colors.primary} name={icon} size={22} style={{ marginBottom: 6 }} />
      <Text className="text-xl font-bold text-slate-900 dark:text-white" nativeID={`team-detail-stat-${label}-value`} testID={`team-detail-stat-${label}-value`}>
        {value}
      </Text>
      <Text className="text-center text-xs text-slate-500 dark:text-slate-400" nativeID={`team-detail-stat-${label}-label`} testID={`team-detail-stat-${label}-label`}>
        {label}
      </Text>
    </View>
  );
}

function Field({ label, value }) {
  return (
    <View className="mb-4" nativeID={`team-detail-field-${label}`} testID={`team-detail-field-${label}`}>
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID={`team-detail-field-${label}-label`} testID={`team-detail-field-${label}-label`}>
        {label}
      </Text>
      <Text className="text-sm leading-5 text-slate-700 dark:text-slate-200" nativeID={`team-detail-field-${label}-value`} testID={`team-detail-field-${label}-value`}>
        {value}
      </Text>
    </View>
  );
}

function RunnerRow({ member, groupName, colors }) {
  const subMeta = SUBSCRIPTION_META[member.subscriptionStatus] ?? SUBSCRIPTION_META.activo;

  return (
    <View
      className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`team-detail-runner-${member.id}`}
      testID={`team-detail-runner-${member.id}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`team-detail-runner-${member.id}-avatar`} testID={`team-detail-runner-${member.id}-avatar`}>
        <MaterialCommunityIcons color={colors.primary} name="account" size={20} />
      </View>
      <Text
        className="flex-1 text-sm font-semibold text-slate-900 dark:text-white"
        nativeID={`team-detail-runner-${member.id}-name`}
        numberOfLines={1}
        testID={`team-detail-runner-${member.id}-name`}
      >
        {member.name}
      </Text>
      <View className="flex-row flex-wrap items-center justify-end gap-1.5" nativeID={`team-detail-runner-${member.id}-tags`} testID={`team-detail-runner-${member.id}-tags`}>
        <Tag
          bg="bg-slate-200 dark:bg-slate-800"
          label={LEVEL_LABELS[member.level] ?? member.level}
          nativeID={`team-detail-runner-${member.id}-level-tag`}
          testID={`team-detail-runner-${member.id}-level-tag`}
          text="text-slate-700 dark:text-slate-200"
        />
        <Tag
          bg="bg-slate-200 dark:bg-slate-800"
          label={groupName}
          nativeID={`team-detail-runner-${member.id}-group-tag`}
          testID={`team-detail-runner-${member.id}-group-tag`}
          text="text-slate-700 dark:text-slate-200"
        />
        <Tag
          bg={subMeta.bg}
          label={subMeta.label}
          nativeID={`team-detail-runner-${member.id}-subscription-tag`}
          testID={`team-detail-runner-${member.id}-subscription-tag`}
          text={subMeta.text}
        />
      </View>
    </View>
  );
}

function GroupRow({ group, memberCount, planName, colors }) {
  return (
    <View
      className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`team-detail-group-${group.id}`}
      testID={`team-detail-group-${group.id}`}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`team-detail-group-${group.id}-icon`} testID={`team-detail-group-${group.id}-icon`}>
        <MaterialCommunityIcons color={colors.primary} name="account-multiple" size={18} />
      </View>
      <View className="flex-1" nativeID={`team-detail-group-${group.id}-info`} testID={`team-detail-group-${group.id}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`team-detail-group-${group.id}-name`} testID={`team-detail-group-${group.id}-name`}>
          {group.name}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`team-detail-group-${group.id}-meta`} testID={`team-detail-group-${group.id}-meta`}>
          {memberCount} {memberCount === 1 ? 'corredor' : 'corredores'} · {planName ?? 'Sin plan asignado'}
        </Text>
      </View>
    </View>
  );
}

// Solo se usa en web (ver TABS más arriba) — misma paleta que los tabs del
// header web (bg-primary-tint-subtle + text-primary cuando está activo).
function TabBar({ active, onChange }) {
  const colors = useThemeColors();

  return (
    <View className="mb-5 flex-row gap-2" nativeID="team-detail-tab-bar" testID="team-detail-tab-bar">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            className={`flex-row items-center gap-1.5 rounded-lg px-3 py-2 ${
              isActive ? 'bg-primary-tint-subtle dark:bg-primary/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            nativeID={`team-detail-tab-${tab.id}`}
            onPress={() => onChange(tab.id)}
            testID={`team-detail-tab-${tab.id}`}
          >
            <MaterialCommunityIcons name={tab.icon} size={16} color={isActive ? colors.primary : colors.onSurfaceVariant} />
            <Text
              className={`text-sm ${isActive ? 'font-semibold text-primary' : 'font-medium text-slate-700 dark:text-slate-200'}`}
              nativeID={`team-detail-tab-${tab.id}-label`}
              testID={`team-detail-tab-${tab.id}-label`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TeamDetailScreen({ teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));

  const [activeTab, setActiveTab] = useState('general');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [period, setPeriod] = useState('todo');

  const groupOptions = useMemo(
    () => (team ? [{ id: '', name: 'Todos los grupos' }, ...team.groups.map((g) => ({ id: g.id, name: g.name }))] : []),
    [team],
  );

  const filteredMembers = useMemo(() => {
    if (!team) return [];
    const query = search.trim().toLowerCase();
    return team.members.filter((member) => {
      const matchesSearch = !query || member.name.toLowerCase().includes(query);
      const matchesGroup = !groupFilter || member.groupId === groupFilter;
      return matchesSearch && matchesGroup;
    });
  }, [team, search, groupFilter]);

  const metrics = MOCK_METRICS_BY_PERIOD[period] ?? MOCK_METRICS_BY_PERIOD.todo;

  if (!team) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="team-detail-not-found" testID="team-detail-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="team-detail-not-found-label" testID="team-detail-not-found-label">
          No encontramos este equipo.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="team-detail-not-found-back-button"
          onPress={() => router.back()}
          testID="team-detail-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="team-detail-not-found-back-button-label" testID="team-detail-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  const statusMeta = TEAM_STATUS_META[team.status] ?? TEAM_STATUS_META.activo;
  const locationLine = [
    team.city,
    team.province ? getProvinceName(team.country, team.province) : null,
    team.country ? getCountryName(team.country) : null,
  ].filter(Boolean).join(', ');

  const generalContent = (
    <>
      <SectionCard icon="information-outline" title="Sobre el equipo">
        <Field label="Descripción" value={display(team.description)} />
        <Field label="Requisitos de pertenencia" value={display(team.requirements)} />
      </SectionCard>

      <SectionCard icon="chart-line" title="Estadísticas del equipo">
        <View className="flex-row gap-3" nativeID="team-detail-stats-row" testID="team-detail-stats-row">
          <StatTile colors={colors} icon="account-group" label="Corredores" value={filteredMembers.length} />
          <StatTile colors={colors} icon="run" label="Entrenamientos realizados" value={metrics.trainingsCompleted} />
          <StatTile colors={colors} icon="flag-checkered" label="Objetivos cumplidos" value={metrics.goalsCompleted} />
        </View>
      </SectionCard>
    </>
  );

  const corredoresContent = (
    <SectionCard icon="account-multiple" title="Corredores">
      <Row>
        <Col>
          <InputField dense label="Buscar corredor" onChange={setSearch} placeholder="Nombre del corredor" value={search} />
        </Col>
        <Col>
          <PickerField dense label="Grupo" onChange={setGroupFilter} options={groupOptions} placeholder="Todos los grupos" value={groupFilter} />
        </Col>
        <Col>
          <PickerField dense label="Período" onChange={setPeriod} options={PERIOD_OPTIONS} placeholder="Todo" value={period} />
        </Col>
      </Row>

      {filteredMembers.length === 0 ? (
        <Text className="py-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="team-detail-runners-empty" testID="team-detail-runners-empty">
          No hay corredores que coincidan con los filtros.
        </Text>
      ) : (
        <View className="gap-2" nativeID="team-detail-runners-list" testID="team-detail-runners-list">
          {filteredMembers.map((member) => (
            <RunnerRow
              colors={colors}
              groupName={team.groups.find((g) => g.id === member.groupId)?.name ?? '—'}
              key={member.id}
              member={member}
            />
          ))}
        </View>
      )}
    </SectionCard>
  );

  const gruposContent = (
    <SectionCard icon="account-group" title="Grupos">
      <View className="gap-2" nativeID="team-detail-groups-list" testID="team-detail-groups-list">
        {team.groups.map((group) => (
          <GroupRow
            colors={colors}
            group={group}
            key={group.id}
            memberCount={team.members.filter((m) => m.groupId === group.id).length}
            planName={TRAINING_PLAN_OPTIONS.find((p) => p.id === group.trainingPlanId)?.name}
          />
        ))}
      </View>
    </SectionCard>
  );

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="team-detail-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="team-detail-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="team-detail-screen-container" testID="team-detail-screen-container">
        <Pressable
          className="mb-6 flex-row items-center gap-1.5 self-start py-1 pr-1 hover:opacity-70 active:opacity-70"
          nativeID="team-detail-back-button"
          onPress={() => router.back()}
          testID="team-detail-back-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          <Text className="text-sm font-medium text-slate-500 dark:text-slate-400" nativeID="team-detail-back-button-label" testID="team-detail-back-button-label">
            Equipos
          </Text>
        </Pressable>

        <View className="mb-5 flex-row items-start gap-4" nativeID="team-detail-header" testID="team-detail-header">
          <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" nativeID="team-detail-photo" testID="team-detail-photo">
            {team.photoUri ? (
              <Image accessibilityLabel={`Foto de ${team.name}`} className="h-16 w-16 rounded-full" nativeID="team-detail-photo-image" source={{ uri: team.photoUri }} testID="team-detail-photo-image" />
            ) : (
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-group" size={30} />
            )}
          </View>
          <View className="flex-1" nativeID="team-detail-header-info" testID="team-detail-header-info">
            <View className="mb-1 flex-row flex-wrap items-center gap-2" nativeID="team-detail-title-row" testID="team-detail-title-row">
              <Text style={{ fontFamily: 'Orbitron_700Bold' }} className="text-xl text-slate-900 dark:text-white" nativeID="team-detail-name" testID="team-detail-name">
                {team.name}
              </Text>
              <Tag bg={statusMeta.bg} label={statusMeta.label} nativeID="team-detail-status-tag" testID="team-detail-status-tag" text={statusMeta.text} />
            </View>
            {locationLine ? (
              <View className="flex-row items-center gap-1" nativeID="team-detail-location-row" testID="team-detail-location-row">
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-outline" size={14} />
                <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="team-detail-location" testID="team-detail-location">
                  {locationLine}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {isWeb ? (
          <>
            <TabBar active={activeTab} onChange={setActiveTab} />
            {activeTab === 'general' && generalContent}
            {activeTab === 'corredores' && corredoresContent}
            {activeTab === 'grupos' && gruposContent}
          </>
        ) : (
          <>
            {generalContent}
            {corredoresContent}
            {gruposContent}
          </>
        )}
      </View>
    </ScrollView>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
import { getCountryName, getProvinceName } from '../../data/locations.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField, PickerField, Row, Col } from '../forms/fields.jsx';

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

// Sin dominio de entrenamientos/actividades todavía (ver FUNCTIONAL_PROPOSE.md,
// "Planificación de entrenamientos" y "Registro y seguimiento de actividades"
// siguen siendo módulos reservados) — valores mock fijos.
const MOCK_TEAM_METRICS = { trainingsCompleted: 210, goalsCompleted: 96 };

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

function SeniorityLine({ member, colors, idPrefix }) {
  return (
    <View className="mt-0.5 flex-row items-center gap-1" nativeID={`${idPrefix}-seniority`} testID={`${idPrefix}-seniority`}>
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="calendar-outline" size={12} />
      <Text
        className="text-xs text-slate-500 dark:text-slate-400"
        nativeID={`${idPrefix}-seniority-label`}
        numberOfLines={1}
        testID={`${idPrefix}-seniority-label`}
      >
        {formatRelativeTime(member.joinedAt)} en el equipo
      </Text>
    </View>
  );
}

// En web hay lugar de sobra para los tags al lado del nombre. En mobile
// (menos ancho) pasa a ser una card expandible: colapsada solo muestra el
// tag con urgencia real (suscripción), el grupo aparece al tocarla.
// Debajo del nombre van email y antigüedad ("hace X en el equipo",
// member.joinedAt vía formatRelativeTime) — texto plano, no tags, para no
// competir por ancho horizontal con los tags de la derecha.
//
// `restricted` (vista de corredor común, no quien gestiona el equipo) usa
// un layout bien distinto y más simple — solo nombre + antigüedad, y el
// tag de grupo nada más si `showGroupTag` (el toggle "Mostrar los grupos a
// los corredores" de Editar equipo) está prendido. Sin email ni
// suscripción de otros corredores. Al ser tan poco contenido no hace falta
// la card expandible de mobile — un layout único alcanza en las dos
// plataformas.
function RunnerRow({ member, groupName, colors, restricted, showGroupTag }) {
  const subMeta = SUBSCRIPTION_META[member.subscriptionStatus] ?? SUBSCRIPTION_META.activo;
  const [expanded, setExpanded] = useState(false);

  const avatar = (
    <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`team-detail-runner-${member.id}-avatar`} testID={`team-detail-runner-${member.id}-avatar`}>
      <MaterialCommunityIcons color={colors.primary} name="account" size={20} />
    </View>
  );

  if (restricted) {
    const groupTag = showGroupTag && (
      <Tag
        bg="bg-slate-200 dark:bg-slate-800"
        label={groupName}
        nativeID={`team-detail-runner-${member.id}-group-tag`}
        testID={`team-detail-runner-${member.id}-group-tag`}
        text="text-slate-700 dark:text-slate-200"
      />
    );

    return (
      <View
        className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        nativeID={`team-detail-runner-${member.id}`}
        testID={`team-detail-runner-${member.id}`}
      >
        {avatar}
        <View className="flex-1" nativeID={`team-detail-runner-${member.id}-identity`} testID={`team-detail-runner-${member.id}-identity`}>
          <Text
            className="text-sm font-semibold text-slate-900 dark:text-white"
            nativeID={`team-detail-runner-${member.id}-name`}
            numberOfLines={1}
            testID={`team-detail-runner-${member.id}-name`}
          >
            {member.name}
          </Text>
          <SeniorityLine colors={colors} idPrefix={`team-detail-runner-${member.id}`} member={member} />
        </View>
        {groupTag}
      </View>
    );
  }

  const groupTag = (
    <Tag
      bg="bg-slate-200 dark:bg-slate-800"
      label={groupName}
      nativeID={`team-detail-runner-${member.id}-group-tag`}
      testID={`team-detail-runner-${member.id}-group-tag`}
      text="text-slate-700 dark:text-slate-200"
    />
  );
  const subscriptionTag = (
    <Tag
      bg={subMeta.bg}
      label={subMeta.label}
      nativeID={`team-detail-runner-${member.id}-subscription-tag`}
      testID={`team-detail-runner-${member.id}-subscription-tag`}
      text={subMeta.text}
    />
  );
  const identity = (
    <View className="flex-1" nativeID={`team-detail-runner-${member.id}-identity`} testID={`team-detail-runner-${member.id}-identity`}>
      <Text
        className="text-sm font-semibold text-slate-900 dark:text-white"
        nativeID={`team-detail-runner-${member.id}-name`}
        numberOfLines={1}
        testID={`team-detail-runner-${member.id}-name`}
      >
        {member.name}
      </Text>
      <Text
        className="text-xs text-slate-500 dark:text-slate-400"
        nativeID={`team-detail-runner-${member.id}-email`}
        numberOfLines={1}
        testID={`team-detail-runner-${member.id}-email`}
      >
        {member.email}
      </Text>
      <SeniorityLine colors={colors} idPrefix={`team-detail-runner-${member.id}`} member={member} />
    </View>
  );

  if (isWeb) {
    return (
      <View
        className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        nativeID={`team-detail-runner-${member.id}`}
        testID={`team-detail-runner-${member.id}`}
      >
        {avatar}
        {identity}
        <View className="flex-row flex-wrap items-center justify-end gap-1.5" nativeID={`team-detail-runner-${member.id}-tags`} testID={`team-detail-runner-${member.id}-tags`}>
          {groupTag}
          {subscriptionTag}
        </View>
      </View>
    );
  }

  return (
    <View
      className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`team-detail-runner-${member.id}`}
      testID={`team-detail-runner-${member.id}`}
    >
      <Pressable
        accessibilityLabel={expanded ? 'Ocultar detalle del corredor' : 'Ver detalle del corredor'}
        className="flex-row items-center gap-3 px-4 py-3 active:opacity-80"
        nativeID={`team-detail-runner-${member.id}-toggle`}
        onPress={() => setExpanded((v) => !v)}
        testID={`team-detail-runner-${member.id}-toggle`}
      >
        {avatar}
        {identity}
        {subscriptionTag}
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>
      {expanded && (
        <View
          className="flex-row flex-wrap items-center gap-1.5 border-t border-slate-200 px-4 py-2.5 dark:border-slate-700"
          nativeID={`team-detail-runner-${member.id}-expanded-tags`}
          testID={`team-detail-runner-${member.id}-expanded-tags`}
        >
          {groupTag}
        </View>
      )}
    </View>
  );
}

function GroupMemberRow({ member, colors }) {
  const subMeta = SUBSCRIPTION_META[member.subscriptionStatus] ?? SUBSCRIPTION_META.activo;
  return (
    <View
      className="flex-row items-center justify-between gap-2 py-1.5"
      nativeID={`team-detail-group-member-${member.id}`}
      testID={`team-detail-group-member-${member.id}`}
    >
      <View className="flex-1 flex-row items-center gap-2" nativeID={`team-detail-group-member-${member.id}-identity`} testID={`team-detail-group-member-${member.id}-identity`}>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account" size={16} />
        <Text
          className="flex-1 text-sm text-slate-700 dark:text-slate-200"
          nativeID={`team-detail-group-member-${member.id}-name`}
          numberOfLines={1}
          testID={`team-detail-group-member-${member.id}-name`}
        >
          {member.name}
        </Text>
      </View>
      <Tag bg={subMeta.bg} label={subMeta.label} nativeID={`team-detail-group-member-${member.id}-subscription-tag`} testID={`team-detail-group-member-${member.id}-subscription-tag`} text={subMeta.text} />
    </View>
  );
}

// Sección "Grupos" ampliada: cada grupo muestra sus datos (plan, cantidad
// de corredores) Y la lista de corredores que lo integran, más un lápiz
// para editar nombre/plan (oculto para el grupo default "Sin grupo" —
// renombrar el bucket al que cae todo corredor sin grupo elegido no tiene
// sentido, y para quien no gestiona el equipo). En web hay lugar de sobra:
// la lista de miembros va siempre visible. En mobile es una card
// expandible, mismo patrón que RunnerRow — colapsada por default, tocarla
// muestra los corredores del grupo.
function GroupRow({ group, members, planName, colors, onEdit, canEdit }) {
  const [expanded, setExpanded] = useState(false);
  const memberCount = members.length;

  const header = (
    <>
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
        {group.description && (
          <Text
            className="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
            nativeID={`team-detail-group-${group.id}-description`}
            numberOfLines={2}
            testID={`team-detail-group-${group.id}-description`}
          >
            {group.description}
          </Text>
        )}
      </View>
    </>
  );

  const editButton = canEdit && (
    <Pressable
      accessibilityLabel={`Editar grupo ${group.name}`}
      className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
      nativeID={`team-detail-group-${group.id}-edit-button`}
      onPress={onEdit}
      testID={`team-detail-group-${group.id}-edit-button`}
    >
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={18} />
    </Pressable>
  );

  const memberList = memberCount > 0 && (
    <View
      className="gap-0.5 border-t border-slate-200 px-4 py-2.5 dark:border-slate-700"
      nativeID={`team-detail-group-${group.id}-members`}
      testID={`team-detail-group-${group.id}-members`}
    >
      {members.map((member) => (
        <GroupMemberRow colors={colors} key={member.id} member={member} />
      ))}
    </View>
  );

  if (isWeb) {
    return (
      <View
        className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
        nativeID={`team-detail-group-${group.id}`}
        testID={`team-detail-group-${group.id}`}
      >
        <View className="flex-row items-center gap-3 px-4 py-3" nativeID={`team-detail-group-${group.id}-header`} testID={`team-detail-group-${group.id}-header`}>
          {header}
          {editButton}
        </View>
        {memberList}
      </View>
    );
  }

  return (
    <View
      className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`team-detail-group-${group.id}`}
      testID={`team-detail-group-${group.id}`}
    >
      <View className="flex-row items-center gap-2 pr-2" nativeID={`team-detail-group-${group.id}-header`} testID={`team-detail-group-${group.id}-header`}>
        <Pressable
          accessibilityLabel={expanded ? 'Ocultar corredores del grupo' : 'Ver corredores del grupo'}
          className="flex-1 flex-row items-center gap-3 py-3 pl-4 active:opacity-80"
          nativeID={`team-detail-group-${group.id}-toggle`}
          onPress={() => setExpanded((v) => !v)}
          testID={`team-detail-group-${group.id}-toggle`}
        >
          {header}
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
        </Pressable>
        {editButton}
      </View>
      {expanded && memberList}
    </View>
  );
}

// Solo se usa en web (ver TABS más arriba) — misma paleta que los tabs del
// header web (bg-primary-tint-subtle + text-primary cuando está activo).
// `tabs` viene filtrado por el caller (sin "Grupos" para corredor común).
function TabBar({ active, onChange, tabs }) {
  const colors = useThemeColors();

  return (
    <View className="mb-5 flex-row gap-2" nativeID="team-detail-tab-bar" testID="team-detail-tab-bar">
      {tabs.map((tab) => {
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
  const fetchTeam = useTeamStore((s) => s.fetchTeam);
  const activeRole = useAuthStore((s) => s.activeRole);
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
  // Mismo criterio que "Crear equipo" en los shells: sin modelo de dueño de
  // equipo todavía, cualquier usuario viendo la app como entrenador activo
  // puede editar equipo/grupos.
  const canManageTeam = hasTrainerRole && activeRole === 'trainer';
  // Un corredor común (no viendo la app como entrenador activo, tenga o no
  // ese rol) ve una versión reducida: sin la pestaña Grupos, y en
  // Corredores solo nombre + antigüedad de cada compañero — el resto
  // (email, suscripción, y el grupo de cada uno) es información que hoy
  // solo ve quien gestiona el equipo.
  const isTrainerView = activeRole === 'trainer';
  // El toggle "Mostrar los grupos a los corredores" (Editar equipo) solo
  // afecta a la vista de corredor común — quien gestiona el equipo siempre
  // ve los grupos, con o sin el toggle prendido.
  const canSeeGroups = isTrainerView || team?.showGroupsToRunners;

  const [activeTab, setActiveTab] = useState('general');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [loadingTeam, setLoadingTeam] = useState(!team);

  // Entrar por deep-link (ej. recargar /teams/{id} directo) puede caer acá
  // antes de que el equipo esté en el store — fetchTeam lo trae puntual.
  useEffect(() => {
    if (team) {
      setLoadingTeam(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingTeam(true);
    fetchTeam(teamId).finally(() => { if (!cancelled) setLoadingTeam(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const groupOptions = useMemo(
    () => (team ? [{ id: '', name: 'Todos los grupos' }, ...team.groups.map((g) => ({ id: g.id, name: g.name }))] : []),
    [team],
  );

  const filteredMembers = useMemo(() => {
    if (!team) return [];
    const query = search.trim().toLowerCase();
    return team.members.filter((member) => {
      const matchesSearch = !query || member.name.toLowerCase().includes(query) || (isTrainerView && member.email.toLowerCase().includes(query));
      const matchesGroup = !groupFilter || member.groupId === groupFilter;
      return matchesSearch && matchesGroup;
    });
  }, [team, search, groupFilter, isTrainerView]);

  if (loadingTeam) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="team-detail-loading" testID="team-detail-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

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
          <StatTile colors={colors} icon="run" label="Entrenamientos realizados" value={MOCK_TEAM_METRICS.trainingsCompleted} />
          <StatTile colors={colors} icon="flag-checkered" label="Objetivos cumplidos" value={MOCK_TEAM_METRICS.goalsCompleted} />
        </View>
      </SectionCard>
    </>
  );

  const corredoresContent = (
    <SectionCard
      headerRight={canManageTeam && (
        <Pressable
          className="rounded-lg px-2 py-1 hover:opacity-70 active:opacity-70"
          nativeID="team-detail-invite-button"
          onPress={() => router.push(`/teams/${team.id}/invite`)}
          testID="team-detail-invite-button"
        >
          <Text className="text-sm font-semibold text-primary" nativeID="team-detail-invite-button-label" testID="team-detail-invite-button-label">
            Invitar
          </Text>
        </Pressable>
      )}
      icon="account-multiple"
      title="Corredores"
    >
      <Row>
        <Col>
          <InputField dense label="Buscar corredor" onChange={setSearch} placeholder={isTrainerView ? 'Nombre o email del corredor' : 'Nombre del corredor'} value={search} />
        </Col>
        {canSeeGroups && (
          <Col>
            <PickerField dense label="Grupo" onChange={setGroupFilter} options={groupOptions} placeholder="Todos los grupos" value={groupFilter} />
          </Col>
        )}
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
              restricted={!isTrainerView}
              showGroupTag={canSeeGroups}
            />
          ))}
        </View>
      )}
    </SectionCard>
  );

  // La pestaña/sección Grupos entera queda oculta para un corredor común
  // — no solo el tag de grupo por corredor (eso lo maneja el toggle
  // showGroupsToRunners), acá no hay excepción posible.
  const gruposContent = isTrainerView && (
    <SectionCard icon="account-group" title="Grupos">
      <View className="gap-2" nativeID="team-detail-groups-list" testID="team-detail-groups-list">
        {team.groups.map((group) => (
          <GroupRow
            canEdit={canManageTeam && !group.isDefault}
            colors={colors}
            group={group}
            key={group.id}
            members={team.members.filter((m) => m.groupId === group.id)}
            onEdit={() => router.push(`/teams/${team.id}/groups/${group.id}/edit`)}
            planName={TRAINING_PLAN_OPTIONS.find((p) => p.id === group.trainingPlanId)?.name}
          />
        ))}
      </View>
    </SectionCard>
  );

  const visibleTabs = isTrainerView ? TABS : TABS.filter((tab) => tab.id !== 'grupos');

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
          {canManageTeam && (
            <Pressable
              accessibilityLabel="Editar equipo"
              className="rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID="team-detail-edit-button"
              onPress={() => router.push(`/teams/${team.id}/edit`)}
              testID="team-detail-edit-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={20} />
            </Pressable>
          )}
        </View>

        {isWeb ? (
          <>
            <TabBar active={activeTab} onChange={setActiveTab} tabs={visibleTabs} />
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

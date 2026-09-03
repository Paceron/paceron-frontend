import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { removeTeamUser } from '../../services/teams.js';
import { removeGroupUser, addGroupUser } from '../../services/groups.js';
import { getUser } from '../../services/auth.js';
import { toUserModel } from '../../services/normalizers.js';
import { getCountryName, getProvinceName } from '../../data/locations.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField, Row, Col } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
import { DeleteTeamModal } from './delete-team-modal.jsx';
import { ExpelRunnerModal } from './expel-runner-modal.jsx';
import { MoveRunnerModal } from './move-runner-modal.jsx';
import { LeaveGroupModal } from './leave-group-modal.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

// Ancho fijo del panel del menú de corredor (w-52 = 208px) — se usa para
// alinear el borde derecho del panel con el del botón de 3 puntitos que lo
// abrió, sin depender de measureInWindow del panel mismo (todavía no está
// montado en el momento de calcular la posición).
const RUNNER_MENU_WIDTH = 208;

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

// El padding horizontal es más chico que el resto de las cards (px-1.5 en
// vez de p-4 parejo) porque "Entrenamientos realizados" — la etiqueta más
// larga de las 3 — necesita ese ancho extra para partir en "Entrenamientos"
// / "realizados" en mobile (3 tiles angostas, flex-1). Sin esto, la palabra
// no entraba y se cortaba mitad de palabra en vez de partir prolijo entre
// las dos. text-[11px] en vez de text-xs (12px) da un margen extra por las
// dudas en pantallas más angostas — sin numberOfLines: se deja crecer a 2
// líneas libremente, no se trunca.
function StatTile({ icon, label, value, colors }) {
  return (
    <View
      className="flex-1 items-center rounded-2xl border border-slate-200 bg-white px-1.5 py-4 dark:border-slate-700 dark:bg-surface"
      nativeID={`team-detail-stat-${label}`}
      testID={`team-detail-stat-${label}`}
    >
      <MaterialCommunityIcons color={colors.primary} name={icon} size={22} style={{ marginBottom: 6 }} />
      <Text className="text-xl font-bold text-slate-900 dark:text-white" nativeID={`team-detail-stat-${label}-value`} testID={`team-detail-stat-${label}-value`}>
        {value}
      </Text>
      <Text className="text-center text-[11px] leading-4 text-slate-500 dark:text-slate-400" nativeID={`team-detail-stat-${label}-label`} testID={`team-detail-stat-${label}-label`}>
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
// Botón de 3 puntitos de un corredor puntual — solo mide su posición y
// avisa a TeamDetailScreen, que muestra un único panel compartido (ver
// RunnerActionsMenu más abajo, montado una sola vez fuera del ScrollView)
// vía el mismo AnimatedDropdown que ya usan el dropdown de usuario y el
// menú de equipos (components/shared/animated-dropdown.jsx) — necesario
// porque un panel local por fila (como estaba antes) queda atrapado en el
// stacking context de su propia card: las cards siguientes lo tapan visualmente
// y no había backdrop para cerrarlo con un click afuera.
//
// Usa measureLayout contra `containerRef` (el View raíz de la pantalla,
// ver TeamDetailScreen) en vez de measureInWindow: React Native Web pone
// `position: relative` por default en TODOS los Views, así que el panel
// absoluto (hijo directo de ese mismo View raíz) termina posicionándose
// relativo a él, no a la ventana. Usar coordenadas de measureInWindow
// (relativas a la ventana) ahí desalinea el panel hacia abajo — el offset
// exacto es la distancia entre el View raíz y el borde de la ventana (acá,
// la altura del header del shell). measureLayout mide directo contra ese
// mismo View raíz, evitando tener que calcular ese offset a mano.
function RunnerMenu({ member, colors, onOpenMenu, containerRef }) {
  const ref = useRef(null);

  const handlePress = () => {
    if (!containerRef.current) return;
    ref.current?.measureLayout(containerRef.current, (x, y, width, height) => {
      onOpenMenu({ x, y, width, height }, member);
    }, () => {});
  };

  return (
    <Pressable
      ref={ref}
      accessibilityLabel="Más opciones"
      className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
      nativeID={`team-detail-runner-${member.id}-menu-toggle`}
      onPress={handlePress}
      testID={`team-detail-runner-${member.id}-menu-toggle`}
    >
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-vertical" size={18} />
    </Pressable>
  );
}

// Contenido del panel compartido — member/onExpel/onMove vienen del padre
// (TeamDetailScreenContent), que trackea qué corredor abrió el menú (ver
// RunnerMenu#handlePress, que ahora pasa `member` a onOpenMenu).
function RunnerActionsMenu({ member, onExpel, onMove }) {
  const colors = useThemeColors();

  return (
    <View className="w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID="team-detail-runner-menu-panel" testID="team-detail-runner-menu-panel">
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="team-detail-runner-menu-move"
        onPress={() => onMove(member)}
        testID="team-detail-runner-menu-move"
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-switch-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="team-detail-runner-menu-move-label" testID="team-detail-runner-menu-move-label">
          Mover de grupo
        </Text>
      </Pressable>
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="team-detail-runner-menu-remove"
        onPress={() => onExpel(member)}
        testID="team-detail-runner-menu-remove"
      >
        <MaterialCommunityIcons color="#ef4444" name="account-remove-outline" size={16} />
        <Text className="text-sm text-red-600 dark:text-red-400" nativeID="team-detail-runner-menu-remove-label" testID="team-detail-runner-menu-remove-label">
          Sacar del equipo
        </Text>
      </Pressable>
    </View>
  );
}

function RunnerRow({ member, groupName, colors, restricted, showGroupTag, onOpenMenu, containerRef }) {
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
        <RunnerMenu colors={colors} containerRef={containerRef} member={member} onOpenMenu={onOpenMenu} />
      </View>
    );
  }

  return (
    <View
      className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`team-detail-runner-${member.id}`}
      testID={`team-detail-runner-${member.id}`}
    >
      <View className="flex-row items-center pr-2" nativeID={`team-detail-runner-${member.id}-header`} testID={`team-detail-runner-${member.id}-header`}>
        <Pressable
          accessibilityLabel={expanded ? 'Ocultar detalle del corredor' : 'Ver detalle del corredor'}
          className="flex-1 flex-row items-center gap-3 px-4 py-3 active:opacity-80"
          nativeID={`team-detail-runner-${member.id}-toggle`}
          onPress={() => setExpanded((v) => !v)}
          testID={`team-detail-runner-${member.id}-toggle`}
        >
          {avatar}
          {identity}
          {subscriptionTag}
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
        </Pressable>
        <RunnerMenu colors={colors} containerRef={containerRef} member={member} onOpenMenu={onOpenMenu} />
      </View>
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
function GroupRow({ group, members, planName, colors, onEdit, canEdit, onDelete, deleting }) {
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
    <View className="flex-row items-center gap-1" nativeID={`team-detail-group-${group.id}-actions`} testID={`team-detail-group-${group.id}-actions`}>
      <Pressable
        accessibilityLabel={`Editar grupo ${group.name}`}
        className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
        nativeID={`team-detail-group-${group.id}-edit-button`}
        onPress={onEdit}
        testID={`team-detail-group-${group.id}-edit-button`}
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={18} />
      </Pressable>
      <Pressable
        accessibilityLabel={`Eliminar grupo ${group.name}`}
        className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
        disabled={deleting}
        nativeID={`team-detail-group-${group.id}-delete-button`}
        onPress={onDelete}
        testID={`team-detail-group-${group.id}-delete-button`}
      >
        {deleting ? <ActivityIndicator color={colors.onSurfaceVariant} size="small" /> : <MaterialCommunityIcons color={colors.onSurfaceVariant} name="trash-can-outline" size={18} />}
      </Pressable>
    </View>
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
        <View className="flex-row items-center gap-2 pr-2" nativeID={`team-detail-group-${group.id}-header`} testID={`team-detail-group-${group.id}-header`}>
          <Pressable
            accessibilityLabel={expanded ? 'Ocultar corredores del grupo' : 'Ver corredores del grupo'}
            className="flex-1 flex-row items-center gap-3 px-4 py-3 hover:opacity-80"
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

function TeamDetailScreenContent({ teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const fetchTeam = useTeamStore((s) => s.fetchTeam);
  const deleteTeam = useTeamStore((s) => s.deleteTeam);
  const fetchGroups = useTeamStore((s) => s.fetchGroups);
  const createGroupInTeam = useTeamStore((s) => s.createGroupInTeam);
  const deleteGroupReal = useTeamStore((s) => s.deleteGroupReal);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const user = useAuthStore((s) => s.user);
  const activeRole = useAuthStore((s) => s.activeRole);
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
  // Mismo criterio que "Crear equipo" en los shells: sin modelo de dueño de
  // equipo todavía, cualquier usuario viendo la app como entrenador activo
  // puede editar equipo/grupos.
  const canManageTeam = hasTrainerRole && activeRole === 'trainer';
  // Eliminar sí es más estricto que editar: el backend ya valida ownerId
  // (DELETE /teams/{id}?user_id=), así que el botón solo se muestra a quien
  // realmente es dueño — mostrarlo a cualquier entrenador solo generaría un
  // error del backend para el resto.
  const canDeleteTeam = canManageTeam && team?.ownerId === user?.userId;
  const uploadTeamIcon = useTeamStore((s) => s.uploadTeamIcon);
  const deleteTeamIcon = useTeamStore((s) => s.deleteTeamIcon);
  const [iconUploading, setIconUploading] = useState(false);

  const handlePickIcon = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'Permiso necesario', text2: 'Habilitá el acceso a tus fotos para elegir una imagen.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Toast.show({ type: 'error', text1: 'La imagen es muy grande', text2: 'El máximo es 5MB.' });
      return;
    }
    setIconUploading(true);
    const uploadResult = await uploadTeamIcon(team.id, asset.uri, asset.mimeType);
    setIconUploading(false);
    if (!uploadResult.success) {
      Toast.show({ type: 'error', text1: 'No pudimos subir el ícono', text2: uploadResult.error });
    }
  };

  const handleRemoveIcon = async () => {
    setIconUploading(true);
    const result = await deleteTeamIcon(team.id);
    setIconUploading(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos borrar el ícono', text2: result.error });
    }
  };

  const { members: allMembers, loading: loadingRoster } = useTeamRoster(team?.id, team?.groups.map((g) => g.id) ?? []);
  // El dueño del equipo aparece en team_users junto con los corredores
  // reales — se filtra acá (no en el hook, que es agnóstico de "quién es
  // dueño") para que no se cuente ni se liste como corredor.
  const members = useMemo(
    () => allMembers.filter((m) => m.userId !== String(team?.ownerId)),
    [allMembers, team?.ownerId],
  );
  const ownerQuery = useQuery({
    queryKey: ['user', team?.ownerId],
    queryFn: () => getUser({ id: team.ownerId }),
    enabled: Boolean(team?.ownerId),
  });
  const ownerUser = ownerQuery.data ? toUserModel(ownerQuery.data) : null;
  const ownerName = ownerUser ? `${ownerUser.name ?? ''} ${ownerUser.surname ?? ''}`.trim() || ownerUser.email : null;
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [addGroupVisible, setAddGroupVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupPlan, setNewGroupPlan] = useState('');
  const [newGroupError, setNewGroupError] = useState(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState(null);

  const handleConfirmDelete = async () => {
    const result = await deleteTeam(team.id, user.userId);
    setDeleteModalVisible(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos eliminar el equipo', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Equipo eliminado' });
    router.replace('/teams');
  };

  const handleAddGroup = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      setNewGroupError('Ingresá un nombre para el grupo.');
      return;
    }
    if (team.groups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
      setNewGroupError('Ya existe un grupo con ese nombre.');
      return;
    }
    setAddingGroup(true);
    const result = await createGroupInTeam(team.id, { name: trimmed, description: newGroupDescription.trim() || null, trainingPlanId: newGroupPlan || null });
    setAddingGroup(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos crear el grupo', text2: result.error });
      return;
    }
    setNewGroupName('');
    setNewGroupDescription('');
    setNewGroupPlan('');
    setNewGroupError(null);
    setAddGroupVisible(false);
    Toast.show({ type: 'success', text1: 'Grupo creado' });
  };

  const handleDeleteGroup = async (group) => {
    setDeletingGroupId(group.id);
    const result = await deleteGroupReal(team.id, group.id);
    setDeletingGroupId(null);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos eliminar el grupo', text2: result.error });
      return;
    }
    invalidateRoster();
    Toast.show({ type: 'success', text1: 'Grupo eliminado' });
  };
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

  // Panel único del menú de un corredor (ver RunnerMenu/RunnerActionsMenu
  // más arriba) — se cierra solo si se cambia de pestaña, para no dejarlo
  // flotando sobre una sección distinta a la de Corredores. `runnerMenuMember`
  // es a quién le abrieron el menú — lo pasa RunnerMenu#handlePress.
  const [runnerMenuOpen, setRunnerMenuOpen] = useState(false);
  const [runnerMenuAnchor, setRunnerMenuAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [runnerMenuMember, setRunnerMenuMember] = useState(null);
  const runnerMenuContainerRef = useRef(null);
  const [expelModalVisible, setExpelModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [leaveGroupModalVisible, setLeaveGroupModalVisible] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setRunnerMenuOpen(false);
  }, [activeTab]);

  const handleOpenRunnerMenu = (anchor, member) => {
    setRunnerMenuAnchor(anchor);
    setRunnerMenuMember(member);
    setRunnerMenuOpen(true);
  };
  const handleCloseRunnerMenu = () => setRunnerMenuOpen(false);

  const invalidateRoster = () => {
    queryClient.invalidateQueries({ queryKey: ['team-users', team.id] });
    team.groups.forEach((g) => queryClient.invalidateQueries({ queryKey: ['group-users', g.id] }));
  };

  const handleRequestExpel = () => {
    setRunnerMenuOpen(false);
    setExpelModalVisible(true);
  };

  const handleConfirmExpel = async () => {
    try {
      await removeTeamUser(team.id, runnerMenuMember.userId);
      invalidateRoster();
      Toast.show({ type: 'success', text1: 'Corredor sacado del equipo' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos sacarlo del equipo', text2: error.message });
    }
    setExpelModalVisible(false);
    setRunnerMenuMember(null);
  };

  const handleRequestMove = () => {
    setRunnerMenuOpen(false);
    setMoveModalVisible(true);
  };

  const handleConfirmMove = async (targetGroupId) => {
    // 2 llamadas seguidas, sin transacción del lado del backend — si la
    // primera (sacar del grupo viejo) sale bien pero la segunda (sumar al
    // nuevo) falla, el corredor queda sin grupo. Se distingue en qué paso
    // falló para no mostrar el mismo mensaje genérico en los dos casos.
    try {
      if (runnerMenuMember.groupId) await removeGroupUser(runnerMenuMember.groupId, runnerMenuMember.userId);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos moverlo de grupo', text2: error.message });
      setMoveModalVisible(false);
      setRunnerMenuMember(null);
      return;
    }
    try {
      await addGroupUser(team.id, targetGroupId, runnerMenuMember.userId);
      invalidateRoster();
      Toast.show({ type: 'success', text1: 'Corredor movido de grupo' });
    } catch {
      invalidateRoster();
      Toast.show({
        type: 'error',
        text1: 'Se sacó del grupo anterior pero no pudimos asignarlo al nuevo',
        text2: 'Volvé a intentar el movimiento desde el menú del corredor.',
      });
    }
    setMoveModalVisible(false);
    setRunnerMenuMember(null);
  };

  // Self-service del corredor: salir de su grupo actual (no del equipo) y
  // caer al grupo principal — mismo fallback que el borrado de grupo (Step
  // 6). Solo tiene sentido si ya está en un grupo no-principal; si está en
  // el principal o el roster todavía no cargó, no hay a dónde "salir".
  const myMembership = members.find((m) => m.userId === String(user?.userId));
  const myGroup = team?.groups.find((g) => g.id === myMembership?.groupId);
  const defaultGroup = team?.groups.find((g) => g.isDefault);
  const canLeaveGroup = Boolean(myMembership && myGroup && !myGroup.isDefault && defaultGroup);

  const handleConfirmLeaveGroup = async () => {
    try {
      await removeGroupUser(myMembership.groupId, myMembership.userId);
      await addGroupUser(team.id, defaultGroup.id, myMembership.userId);
      invalidateRoster();
      Toast.show({ type: 'success', text1: 'Saliste del grupo' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos sacarte del grupo', text2: error.message });
    }
    setLeaveGroupModalVisible(false);
  };

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

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoadingGroups(true);
    fetchGroups(teamId, user.userId).finally(() => { if (!cancelled) setLoadingGroups(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, user?.userId]);

  const groupOptions = useMemo(
    () => (team ? [{ id: '', name: 'Todos los grupos' }, ...team.groups.map((g) => ({ id: g.id, name: g.name }))] : []),
    [team],
  );

  const filteredMembers = useMemo(() => {
    if (!team) return [];
    const query = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesSearch = !query || member.name.toLowerCase().includes(query) || (isTrainerView && member.email.toLowerCase().includes(query));
      const matchesGroup = !groupFilter || member.groupId === groupFilter;
      return matchesSearch && matchesGroup;
    });
  }, [team, members, search, groupFilter, isTrainerView]);

  if (loadingTeam || loadingGroups) {
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
        <Field label="Entrenador a cargo" value={display(ownerName)} />
        <Field label="Descripción" value={display(team.description)} />
        <Field label="Requisitos de pertenencia" value={display(team.requirements)} />
      </SectionCard>

      <SectionCard icon="chart-line" title="Estadísticas del equipo">
        <View className="flex-row gap-2" nativeID="team-detail-stats-row" testID="team-detail-stats-row">
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
      {/* Sin corredores en el equipo (todavía, no por filtro) no tiene
          sentido mostrar el buscador — no hay nada para buscar. */}
      {(loadingRoster || members.length > 0) && (
        <View className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900" nativeID="team-detail-search-row" testID="team-detail-search-row">
          {/* Ninguno de los dos campos muestra error de validación (son
              filtros, no un formulario) — hideErrorRow saca la fila de 20px
              que InputField/PickerField reservan siempre para eso en
              formularios reales (esos NO cambian, hideErrorRow es opt-in).
              El margen propio del field también se anula (className="mb-0")
              — el espacio entre "Buscar corredor" y "Grupo" pasa a
              controlarlo un solo lugar, el propio Row (narrowClassName). Va
              en gap-3.5 (14px) y no gap-3 (12px) — igualando visualmente el
              padding-top del frame (12px) hasta la primera etiqueta, porque
              ahí no hay ningún borde/caja antes que "coma" espacio como sí
              lo hace el borde inferior del campo de arriba. */}
          <Row narrowClassName="gap-3.5">
            <Col>
              <InputField className="mb-0" dense hideErrorRow label="Buscar corredor" onChange={setSearch} placeholder={isTrainerView ? 'Nombre o email del corredor' : 'Nombre del corredor'} value={search} />
            </Col>
            {canSeeGroups && (
              <Col>
                <ResponsiveSelectField className="mb-0" dense hideErrorRow label="Grupo" onChange={setGroupFilter} options={groupOptions} placeholder="Todos los grupos" value={groupFilter} />
              </Col>
            )}
          </Row>
        </View>
      )}

      {loadingRoster ? (
        <View className="items-center py-4" nativeID="team-detail-runners-loading" testID="team-detail-runners-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : members.length === 0 ? (
        <Text className="py-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="team-detail-runners-empty" testID="team-detail-runners-empty">
          ¡Aún no hay corredores!
        </Text>
      ) : filteredMembers.length === 0 ? (
        <Text className="py-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="team-detail-runners-no-matches" testID="team-detail-runners-no-matches">
          No hay corredores que coincidan con los filtros.
        </Text>
      ) : (
        <View className="gap-2" nativeID="team-detail-runners-list" testID="team-detail-runners-list">
          {filteredMembers.map((member) => (
            <RunnerRow
              colors={colors}
              containerRef={runnerMenuContainerRef}
              groupName={team.groups.find((g) => g.id === member.groupId)?.name ?? '—'}
              key={member.id}
              member={member}
              onOpenMenu={handleOpenRunnerMenu}
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
    <SectionCard
      headerRight={canManageTeam && (
        <Pressable
          accessibilityLabel="Agregar grupo"
          className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
          nativeID="team-detail-add-group-button"
          onPress={() => setAddGroupVisible((v) => !v)}
          testID="team-detail-add-group-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="plus" size={20} />
        </Pressable>
      )}
      icon="account-group"
      title="Grupos"
    >
      {addGroupVisible && (
        <View className="mb-6 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="team-detail-add-group-form" testID="team-detail-add-group-form">
          <Row>
            <Col>
              <InputField
                dense
                error={newGroupError}
                label="Nombre del grupo"
                onChange={(text) => { setNewGroupName(text); if (newGroupError) setNewGroupError(null); }}
                placeholder="Ej. Grupo avanzado"
                value={newGroupName}
              />
              <ResponsiveSelectField
                dense
                label="Plan de entrenamiento"
                onChange={setNewGroupPlan}
                options={TRAINING_PLAN_OPTIONS}
                placeholder={TRAINING_PLAN_OPTIONS.length === 0 ? 'Sin planes disponibles todavía' : 'Sin plan asignado'}
                value={newGroupPlan}
              />
            </Col>
            <Col>
              <View className="flex-1" nativeID="team-detail-add-group-description-wrapper" testID="team-detail-add-group-description-wrapper">
                <InputField
                  dense
                  label="Descripción del grupo"
                  multiline
                  numberOfLines={5}
                  onChange={setNewGroupDescription}
                  placeholder="Ej. Corredores con mayor volumen y ritmo."
                  value={newGroupDescription}
                />
              </View>
            </Col>
          </Row>
          <Pressable
            className="h-10 flex-row items-center justify-center gap-2 self-start rounded-full bg-primary px-5 hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={addingGroup}
            nativeID="team-detail-add-group-submit"
            onPress={handleAddGroup}
            testID="team-detail-add-group-submit"
          >
            {addingGroup ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="team-detail-add-group-submit-label" testID="team-detail-add-group-submit-label">
                Crear grupo
              </Text>
            )}
          </Pressable>
        </View>
      )}

      <View className="gap-2" nativeID="team-detail-groups-list" testID="team-detail-groups-list">
        {[...team.groups].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)).map((group) => (
          <GroupRow
            canEdit={canManageTeam && !group.isDefault}
            colors={colors}
            deleting={deletingGroupId === group.id}
            group={group}
            key={group.id}
            members={members.filter((m) => m.groupId === group.id)}
            onDelete={() => handleDeleteGroup(group)}
            onEdit={() => router.push(`/teams/${team.id}/groups/${group.id}/edit`)}
            planName={TRAINING_PLAN_OPTIONS.find((p) => p.id === group.trainingPlanId)?.name}
          />
        ))}
      </View>
    </SectionCard>
  );

  const visibleTabs = isTrainerView ? TABS : TABS.filter((tab) => tab.id !== 'grupos');

  return (
    <View className="relative flex-1" nativeID="team-detail-screen-root" ref={runnerMenuContainerRef} testID="team-detail-screen-root">
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
          <AvatarPicker
            accessibilityLabel={`Ícono de ${team.name}`}
            fallbackIcon="account-group"
            idPrefix="team-detail-photo"
            loading={iconUploading}
            onPick={canDeleteTeam ? handlePickIcon : undefined}
            onRemove={canDeleteTeam ? handleRemoveIcon : undefined}
            size={64}
            uri={team.iconUrl}
          />
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
          {canDeleteTeam && (
            <Pressable
              accessibilityLabel="Eliminar equipo"
              className="rounded-full p-2 hover:bg-red-50 active:opacity-70 dark:hover:bg-red-900/20"
              nativeID="team-detail-delete-button"
              onPress={() => setDeleteModalVisible(true)}
              testID="team-detail-delete-button"
            >
              <MaterialCommunityIcons color={colors.error} name="trash-can-outline" size={20} />
            </Pressable>
          )}
          {!isTrainerView && canLeaveGroup && (
            <Pressable
              accessibilityLabel="Salir del grupo"
              className="rounded-full p-2 hover:bg-red-50 active:opacity-70 dark:hover:bg-red-900/20"
              nativeID="team-detail-leave-group-button"
              onPress={() => setLeaveGroupModalVisible(true)}
              testID="team-detail-leave-group-button"
            >
              <MaterialCommunityIcons color={colors.error} name="exit-run" size={20} />
            </Pressable>
          )}
        </View>

        {isWeb ? (
          <>
            <TabBar active={activeTab} onChange={setActiveTab} scope="team-detail-tab-bar" tabs={visibleTabs} />
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

      {canDeleteTeam && (
        <DeleteTeamModal
          onCancel={() => setDeleteModalVisible(false)}
          onConfirm={handleConfirmDelete}
          teamName={team.name}
          visible={deleteModalVisible}
        />
      )}

      {runnerMenuMember && (
        <>
          <ExpelRunnerModal
            onCancel={() => setExpelModalVisible(false)}
            onConfirm={handleConfirmExpel}
            runnerName={runnerMenuMember.name}
            visible={expelModalVisible}
          />
          <MoveRunnerModal
            currentGroupId={runnerMenuMember.groupId}
            groups={team.groups}
            onCancel={() => setMoveModalVisible(false)}
            onConfirm={handleConfirmMove}
            runnerName={runnerMenuMember.name}
            visible={moveModalVisible}
          />
        </>
      )}

      {canLeaveGroup && (
        <LeaveGroupModal
          groupName={myGroup.name}
          onCancel={() => setLeaveGroupModalVisible(false)}
          onConfirm={handleConfirmLeaveGroup}
          visible={leaveGroupModalVisible}
        />
      )}
    </ScrollView>
    <AnimatedDropdown
      anchorStyle={{
        left: Math.max(8, runnerMenuAnchor.x + runnerMenuAnchor.width - RUNNER_MENU_WIDTH),
        top: runnerMenuAnchor.y + runnerMenuAnchor.height + 4,
      }}
      onClose={handleCloseRunnerMenu}
      open={runnerMenuOpen}
    >
      <RunnerActionsMenu member={runnerMenuMember} onExpel={handleRequestExpel} onMove={handleRequestMove} />
    </AnimatedDropdown>
    </View>
  );
}

export function TeamDetailScreen({ teamId }) {
  return (
    <RequireAuth>
      <TeamDetailScreenContent teamId={teamId} />
    </RequireAuth>
  );
}

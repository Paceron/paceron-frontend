import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { DASHBOARD_KEYS } from '../../hooks/use-dashboard-query.js';
import { getDashboardSummary } from '../../services/dashboard.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser, usePermissions } from '../../hooks/use-user.js';
import { useTeam, useTeamMutations } from '../../hooks/use-teams.js';
import { useGroups, useGroupMutations } from '../../hooks/use-groups.js';
import { useInvitationMutations } from '../../hooks/use-invitations.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { useTeamSubscriptions } from '../../hooks/use-team-subscriptions.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { removeTeamUser } from '../../services/teams.js';
import { removeGroupUser, addGroupUser } from '../../services/groups.js';
import { getCountryName, getProvinceName } from '../../data/locations.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InlinePicker, Row, Col } from '../forms/fields.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { ScreenCard } from '../shared/screen-card.jsx';
import { SkeletonBlock, SkeletonCircle } from '../shared/skeleton.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';
import { useTeamDetailTabStore } from '../../store/team-detail-tab-store.js';
import { CreateGroupModal } from './create-group-modal.jsx';
import { InviteMemberModal } from './invite-member-modal.jsx';
import { DeleteTeamModal } from './delete-team-modal.jsx';
import { DeleteGroupModal } from './delete-group-modal.jsx';
import { ExpelRunnerModal } from './expel-runner-modal.jsx';
import { MoveRunnerModal } from './move-runner-modal.jsx';
import { LeaveGroupModal } from './leave-group-modal.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { TeamJoinRequestsSection } from './team-requests-tab.jsx';
import { useTeamJoinRequests } from '../../hooks/use-join-requests.js';
import { LeaderboardTab } from './leaderboard-tab.jsx';
import { CompetitionsTab } from './competitions-tab.jsx';
import { useCompetitions } from '../../hooks/use-competitions.js';
import { TeamSubscriptionPendingBanner } from './team-subscription-pending-banner.jsx';
import { DashboardScreen } from '../dashboard/dashboard-screen.jsx';
import { useTeamSubscription } from '../../hooks/use-team-subscription.js';
import { TeamInfoModal } from './team-info-modal.jsx';
import { RunnerDetailModal } from './runner-detail-modal.jsx';

// Ancho fijo del panel del menú de corredor (w-52 = 208px) — se usa para
// alinear el borde derecho del panel con el del botón de 3 puntitos que lo
// abrió, sin depender de measureInWindow del panel mismo (todavía no está
// montado en el momento de calcular la posición).
const RUNNER_MENU_WIDTH = 208;

// Mismos 3 estados que ya prevé "Sistema de suscripciones y cobros" en
// FUNCTIONAL_PROPOSE.md, colores igual que STATUS_META en profile-screen.jsx
// para no inventar una paleta nueva. Conectado a datos reales desde el Gap 41
// (GET /teams/{id}/subscriptions) vía SUBSCRIPTION_STATUS_FROM_BACKEND más
// abajo — sin esos datos (loading, 403, equipo que todavía no se consultó),
// el fallback de member.subscriptionStatus a `activo` en el uso de este mapa
// sigue siendo el default histórico, no una lectura real.
const SUBSCRIPTION_META = {
  activo: {
    label: 'Activo', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary',
    icon: 'check-circle-outline', iconColor: '#3c6b12',
  },
  vencido: {
    label: 'Vencido', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400',
    icon: 'alert-circle-outline', iconColor: '#b91c1c',
  },
  en_prueba: {
    label: 'En prueba', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400',
    icon: 'clock-outline', iconColor: '#b45309',
  },
};

// El `status` de GET /teams/{id}/subscriptions ya viene "listo para el
// badge" según el backend (active/overdue/first_payment_pending) -- esto
// solo traduce esos valores a las keys en español de SUBSCRIPTION_META.
const SUBSCRIPTION_STATUS_FROM_BACKEND = {
  active: 'activo',
  overdue: 'vencido',
  first_payment_pending: 'en_prueba',
};

const TEAM_STATUS_META = {
  activo: { label: 'Activo', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  inactivo: { label: 'Inactivo', bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300' },
};

// Pestañas, en las dos plataformas (antes solo en web, mobile apilaba las
// 4 secciones en una sola pantalla sin navegación por pestañas -- misma
// pieza de TabBar que ya usaba web, solo se sacó el gate de isWeb).
//
// `rendimiento` NO pasa por `visibleTabs`: ese filtro solo saca `grupos`, así
// que la pestaña aparece para los dos roles sola — que es lo que quiere, cada
// uno con su variante de la pantalla de rendimiento.
//
// Las solicitudes de ingreso ya no tienen pestaña propia: viven arriba de la
// lista de Corredores, solo para el dueño. `?tab=solicitudes` (links viejos,
// notificaciones) cae en Corredores vía TAB_ALIASES.
const TABS = [
  { id: 'corredores', label: 'Corredores', icon: 'account-multiple' },
  { id: 'grupos', label: 'Grupos', icon: 'account-group' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'podium-gold' },
  { id: 'competencias', label: 'Competencias', icon: 'sword-cross' },
  { id: 'rendimiento', label: 'Rendimiento', icon: 'chart-timeline-variant' },
];

const TAB_ALIASES = { solicitudes: 'corredores' };

function Tag({ label, bg, text, icon, iconColor, nativeID, testID }) {
  return (
    <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${bg}`} nativeID={nativeID} testID={testID}>
      {icon && <MaterialCommunityIcons className={text} color={iconColor} name={icon} size={12} />}
      <Text className={`text-xs font-semibold ${text}`} nativeID={`${nativeID}-label`} testID={`${testID}-label`}>{label}</Text>
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
// El panel (hijo del View raíz vía AnimatedDropdown) se posiciona relativo
// a ese mismo View raíz, no a la ventana — así que hace falta el offset del
// botón respecto al raíz, no su posición absoluta en pantalla.
// measureInWindow (relativo a la ventana) en el botón y en `containerRef`
// por separado, restando ambos, da ese offset sin depender de measureLayout
// — API legacy que en Android con New Architecture (`newArchEnabled` en
// app.config.js) puede no disparar su callback de éxito ni el de fallo,
// dejando el tap sin ningún efecto visible (bug real, encontrado en device).
function RunnerMenu({ member, colors, onOpenMenu, containerRef }) {
  const ref = useRef(null);

  const handlePress = () => {
    if (!containerRef.current || !ref.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu({ x: x - containerX, y: y - containerY, width, height }, member);
      });
    });
  };

  return (
    <IconTooltip idPrefix={`team-detail-runner-${member.id}-menu-toggle-tooltip`} label="Más opciones">
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
    </IconTooltip>
  );
}

// Contenido del panel compartido — member/onExpel/onMove vienen del padre
// (TeamDetailScreenContent), que trackea qué corredor abrió el menú (ver
// RunnerMenu#handlePress, que ahora pasa `member` a onOpenMenu).
function RunnerActionsMenu({ member, onExpel, onMove, onDetail }) {
  const colors = useThemeColors();

  return (
    <View className="w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID="team-detail-runner-menu-panel" testID="team-detail-runner-menu-panel">
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="team-detail-runner-menu-detail"
        onPress={() => onDetail(member)}
        testID="team-detail-runner-menu-detail"
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="information-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="team-detail-runner-menu-detail-label" testID="team-detail-runner-menu-detail-label">
          Ver detalle
        </Text>
      </Pressable>
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

function RunnerRow({ member, groupName, colors, restricted, showGroupTag, onOpenMenu, onOpenDetail, containerRef }) {
  const subMeta = SUBSCRIPTION_META[member.subscriptionStatus] ?? SUBSCRIPTION_META.activo;
  const [expanded, setExpanded] = useState(false);

  const avatar = (
    <View className="h-10 w-10 m-1 ml-2 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`team-detail-runner-${member.id}-avatar`} testID={`team-detail-runner-${member.id}-avatar`}>
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

    // Tappable para abrir el detalle solo si el toggle "Mostrar los grupos
    // a los corredores" está prendido (`showGroupTag` ya ES ese flag acá --
    // en esta rama `restricted` siempre corre con !isTrainerView, así que
    // `canSeeGroups` se reduce exactamente a `team.showGroupsToRunners`).
    // Sin eso prendido, la fila queda igual que antes: un View sin gesto.
    const RowContainer = showGroupTag ? Pressable : View;
    const rowProps = showGroupTag
      ? { accessibilityLabel: `Ver detalle de ${member.name}`, accessibilityRole: 'button', onPress: () => onOpenDetail(member) }
      : {};

    return (
      <RowContainer
        className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 active:opacity-80 dark:border-slate-700 dark:bg-slate-900"
        nativeID={`team-detail-runner-${member.id}`}
        testID={`team-detail-runner-${member.id}`}
        {...rowProps}
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
      </RowContainer>
    );
  }

  const groupTag = (
    <Tag
      bg="bg-slate-200 dark:bg-slate-800"
      icon="account-group-outline"
      iconColor="#334155"
      label={groupName}
      nativeID={`team-detail-runner-${member.id}-group-tag`}
      testID={`team-detail-runner-${member.id}-group-tag`}
      text="text-slate-700 dark:text-slate-200"
    />
  );
  const subscriptionTag = (
    <Tag
      bg={subMeta.bg}
      icon={subMeta.icon}
      iconColor={subMeta.iconColor}
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
        className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900"
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
      <Tag bg={subMeta.bg} icon={subMeta.icon} iconColor={subMeta.iconColor} label={subMeta.label} nativeID={`team-detail-group-member-${member.id}-subscription-tag`} testID={`team-detail-group-member-${member.id}-subscription-tag`} text={subMeta.text} />
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
function GroupRow({ group, members, colors, onEdit, canEdit, onDelete, deleting, onViewCalendar, canManageTeam }) {
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
          {memberCount} {memberCount === 1 ? 'corredor' : 'corredores'}
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

  const actions = canManageTeam && (
    <View className="flex-row items-center gap-1" nativeID={`team-detail-group-${group.id}-actions`} testID={`team-detail-group-${group.id}-actions`}>
      <IconTooltip idPrefix={`team-detail-group-${group.id}-calendar-button-tooltip`} label={`Ver calendario de ${group.name}`}>
        <Pressable
          accessibilityLabel={`Ver calendario de ${group.name}`}
          className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
          nativeID={`team-detail-group-${group.id}-calendar-button`}
          onPress={onViewCalendar}
          testID={`team-detail-group-${group.id}-calendar-button`}
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="calendar-month-outline" size={18} />
        </Pressable>
      </IconTooltip>
      {canEdit && (
        <IconTooltip idPrefix={`team-detail-group-${group.id}-edit-button-tooltip`} label={`Editar grupo ${group.name}`}>
          <Pressable
            accessibilityLabel={`Editar grupo ${group.name}`}
            className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
            nativeID={`team-detail-group-${group.id}-edit-button`}
            onPress={onEdit}
            testID={`team-detail-group-${group.id}-edit-button`}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={18} />
          </Pressable>
        </IconTooltip>
      )}
      {canEdit && (
        <IconTooltip idPrefix={`team-detail-group-${group.id}-delete-button-tooltip`} label={`Eliminar grupo ${group.name}`}>
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
        </IconTooltip>
      )}
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
          {actions}
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
        {actions}
      </View>
      {expanded && memberList}
    </View>
  );
}

function TeamDetailScreenContent({ teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const { team, loading: loadingTeam } = useTeam(teamId);
  const { groups, loading: loadingGroups } = useGroups(teamId, user?.userId);
  const { deleteTeam, uploadTeamIcon, deleteTeamIcon } = useTeamMutations();
  const { createGroup: createGroupInTeam, deleteGroup: deleteGroupReal } = useGroupMutations(teamId);
  const { sendInvite } = useInvitationMutations();
  const activeRole = useAuthStore((s) => s.activeRole);
  const { roles } = usePermissions(userId);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
  // Mismo criterio que "Crear equipo" en los shells: sin modelo de dueño de
  // equipo todavía, cualquier usuario viendo la app como entrenador activo
  // puede editar equipo/grupos.
  const canManageTeam = hasTrainerRole && activeRole === 'trainer';
  // Eliminar sí es más estricto que editar: el backend ya valida ownerId
  // (DELETE /teams/{id}?user_id=), así que el botón solo se muestra a quien
  // realmente es dueño — mostrarlo a cualquier entrenador solo generaría un
  // error del backend para el resto.
  const canDeleteTeam = canManageTeam && team?.ownerId === user?.userId;
  // Solo el dueño ve (y puede listar) las solicitudes; el badge de la pestaña
  // Corredores avisa que hay alguna esperando.
  const { requests: joinRequests } = useTeamJoinRequests(team?.id, { enabled: canDeleteTeam });
  const hasPendingRequests = canDeleteTeam && joinRequests.length > 0;
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
    const uploadResult = await uploadTeamIcon({ teamId: team.id, uri: asset.uri, mimeType: asset.mimeType });
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

  const { members: allMembers, loading: loadingRoster } = useTeamRoster(team?.id, groups.map((g) => g.id));
  const { hasUnseen: competitionsHasUnseen } = useCompetitions(team?.id);
  // El dueño del equipo aparece en team_users junto con los corredores
  // reales — se filtra acá (no en el hook, que es agnóstico de "quién es
  // dueño") para que no se cuente ni se liste como corredor.
  const rosterMembers = useMemo(
    () => allMembers.filter((m) => m.userId !== String(team?.ownerId)),
    [allMembers, team?.ownerId],
  );
  // Gap 41: GET /teams/{id}/subscriptions es entrenador/owner-only (403 para
  // el resto) -- mismo gate laxo (`activeRole`, no ownership real de ESTE
  // equipo) que ya usa canManageTeam más abajo, el backend es quien enforcea
  // de verdad.
  const { subscriptionsByUserId } = useTeamSubscriptions(team?.id, { enabled: activeRole === 'trainer' });
  // Se pisa `member.subscriptionStatus` (hardcodeado a null en
  // use-team-roster.js) solo si llegó un dato real -- sin eso (vista de
  // corredor, 403, o toda vía sin respuesta) el fallback a `activo` de
  // SUBSCRIPTION_META sigue siendo el default histórico, no una lectura real.
  const members = useMemo(() => {
    if (subscriptionsByUserId.size === 0) return rosterMembers;
    return rosterMembers.map((m) => {
      const sub = subscriptionsByUserId.get(m.userId);
      if (!sub) return m;
      return { ...m, subscriptionStatus: SUBSCRIPTION_STATUS_FROM_BACKEND[sub.status] ?? m.subscriptionStatus };
    });
  }, [rosterMembers, subscriptionsByUserId]);
  // Bug real encontrado 2026-10-11: esto era antes su propia useQuery con
  // queryFn: () => getUser({id}) (dto crudo, sin pasar por toUserModel) --
  // misma queryKey ['user', id] que usa useUser abajo, así que cuando el
  // dueño del equipo ES el usuario logueado (visitar tu propio equipo,
  // el caso normal) las dos competían por el mismo slot de caché. Cada
  // invalidateQueries() app-wide (ForegroundRefetch) disparaba un refetch
  // de ambas a la vez, y la que terminaba última pisaba la caché con su
  // propio shape -- si ganaba esta, `userId` (camelCase) desaparecía
  // porque el dto crudo solo tiene `user_id` (snake_case), rompiendo
  // `canDeleteTeam` en cualquier otro componente que leyera ese mismo
  // user vía useUser. Reusar useUser (mismo hook, misma normalización)
  // en vez de una query manual con shape distinto resuelve la carrera de
  // raíz -- ambos casos comparten la misma queryFn, no hay dos formas
  // distintas de resolver el mismo id.
  const { user: ownerUser } = useUser(team?.ownerId);
  const ownerName = ownerUser ? `${ownerUser.name ?? ''} ${ownerUser.surname ?? ''}`.trim() || ownerUser.email : null;
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState(null);
  const [groupPendingDelete, setGroupPendingDelete] = useState(null);

  const handleConfirmDelete = async () => {
    const result = await deleteTeam({ teamId: team.id, userId: user.userId });
    setDeleteModalVisible(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos eliminar el equipo', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Equipo eliminado' });
    router.replace('/teams');
  };

  const handleDeleteGroup = async (group) => {
    setDeletingGroupId(group.id);
    const defaultGroupId = groups.find((g) => g.isDefault)?.id;
    const result = await deleteGroupReal({ groupId: group.id, defaultGroupId });
    setDeletingGroupId(null);
    setGroupPendingDelete(null);
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

  const params = useLocalSearchParams();
  // Zustand (sin persist), no useState -- esta pantalla se remonta al
  // navegar afuera y volver (ej. al calendario de un grupo, al detalle
  // de un corredor), lo que perdía la pestaña elegida. Un deep link con
  // `?tab=` sigue pudiendo forzar una pestaña puntual al entrar, pero
  // solo una vez por montaje (si no, pisaría la pestaña recordada en
  // cualquier re-render futuro de este mismo montaje).
  const activeTab = useTeamDetailTabStore((s) => s.activeTab);
  const setActiveTab = useTeamDetailTabStore((s) => s.setActiveTab);
  const appliedTabParamRef = useRef(false);
  useEffect(() => {
    if (appliedTabParamRef.current) return;
    appliedTabParamRef.current = true;
    const tab = TAB_ALIASES[params.tab] ?? params.tab;
    if (TABS.some((t) => t.id === tab)) setActiveTab(tab);
  }, [params.tab, setActiveTab]);
  const scrollViewRef = useRef(null);
  const focusCompetitionId = params.focus ?? null;
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

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
  // "Sobre el equipo" (antes la pestaña General) y el detalle de un
  // corredor puntual -- ver TeamInfoModal/RunnerDetailModal más abajo.
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [runnerDetailMember, setRunnerDetailMember] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!team?.id) return;
    queryClient.prefetchQuery({
      queryKey: DASHBOARD_KEYS.summary({ teamId: team.id }),
      queryFn: () => getDashboardSummary({ teamId: team.id }),
    });
  }, [team?.id, queryClient]);

  useEffect(() => {
    setRunnerMenuOpen(false);
  }, [activeTab]);

  const handleOpenRunnerMenu = (anchor, member) => {
    setRunnerMenuAnchor(anchor);
    setRunnerMenuMember(member);
    setRunnerMenuOpen(true);
  };
  const handleCloseRunnerMenu = () => setRunnerMenuOpen(false);

  const handleOpenRunnerDetail = (member) => {
    setRunnerMenuOpen(false);
    setRunnerDetailMember(member);
  };

  const invalidateRoster = () => {
    queryClient.invalidateQueries({ queryKey: ['team-users', team.id] });
    groups.forEach((g) => queryClient.invalidateQueries({ queryKey: ['group-users', g.id] }));
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
  const myGroup = groups.find((g) => g.id === myMembership?.groupId);
  const defaultGroup = groups.find((g) => g.isDefault);
  const canLeaveGroup = Boolean(myMembership && myGroup && !myGroup.isDefault && defaultGroup);

  // Cuota del equipo: solo le interesa al corredor que lo integra, y solo si el
  // equipo cobra — por eso la query queda apagada en la vista de entrenador y en
  // equipos gratis (donde el backend devuelve `active` sin cuotas de todas
  // formas, pero sería una request al vacío).
  const teamCharges = (team?.membershipFee ?? 0) > 0;
  const { subscription, isPendingFirstPayment, hasDebt, nextInstallment } = useTeamSubscription(user?.userId, team?.id, {
    enabled: teamCharges && !isTrainerView && Boolean(myMembership),
  });
  // No bloquea nada, solo avisa — el backend tampoco bloquea por falta de pago
  // (ver la spec de esta feature). Se muestra también al día: es el único
  // acceso a la pantalla de la cuota desde el equipo, y la cuota siguiente se
  // puede pagar antes de que venza.
  const showSubscriptionBanner = teamCharges && !isTrainerView && Boolean(subscription);

  const handleConfirmLeaveGroup = async () => {
    try {
      await removeGroupUser(myMembership.groupId, myMembership.userId);
      await addGroupUser(team.id, defaultGroup.id, myMembership.userId);
      Toast.show({ type: 'success', text1: 'Saliste del grupo' });
    } catch (error) {
      // invalidateRoster también en el catch: si removeGroupUser ya se
      // aplicó server-side pero addGroupUser falla después, el roster en
      // caché queda desalineado con el estado real (usuario ya sacado del
      // grupo viejo, todavía no asignado al default) — sin refrescar acá,
      // la UI sigue mostrando datos viejos y el botón de esta misma acción
      // puede desaparecer sin explicación (canLeaveGroup ya no matchea).
      Toast.show({ type: 'error', text1: 'No pudimos sacarte del grupo', text2: error.message });
    }
    invalidateRoster();
    setLeaveGroupModalVisible(false);
  };

  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['team', teamId] }),
    queryClient.invalidateQueries({ queryKey: ['groups', teamId] }),
    queryClient.invalidateQueries({ queryKey: ['team-users', teamId] }),
    queryClient.invalidateQueries({ queryKey: ['group-users'] }),
    queryClient.invalidateQueries({ queryKey: ['join-requests-team', teamId] }),
    queryClient.invalidateQueries({ queryKey: ['users-batch', teamId] }),
    queryClient.invalidateQueries({ queryKey: ['leaderboard', teamId] }),
    queryClient.invalidateQueries({ queryKey: ['competitions', teamId] }),
  ]));

  // Sin la opción sintética "Todos los grupos" — InlinePicker ya resuelve
  // el "sin filtro" con su propio placeholder (showPlaceholderOption).
  const groupOptions = useMemo(() => groups.map((g) => ({ id: g.id, name: g.name })), [groups]);

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
        <ActivityIndicator color="#8cc63e" />
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

  const corredoresContent = (
    <View className="gap-4" nativeID="team-detail-runners-tab" testID="team-detail-runners-tab">
      {canDeleteTeam && <TeamJoinRequestsSection teamId={team.id} />}
      <SectionCard
        variant="nested"
        headerRight={canManageTeam && (
          <View className="flex-row items-center gap-1" nativeID="team-detail-invite-actions" testID="team-detail-invite-actions">
            <IconTooltip idPrefix="team-detail-invite-pending-button-tooltip" label="Ver solicitudes pendientes">
              <Pressable
                accessibilityLabel="Ver solicitudes pendientes"
                className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
                nativeID="team-detail-invite-pending-button"
                onPress={() => router.push(`/teams/${team.id}/invite`)}
                testID="team-detail-invite-pending-button"
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="email-check-outline" size={20} />
              </Pressable>
            </IconTooltip>
            <IconTooltip idPrefix="team-detail-invite-button-tooltip" label="Invitar corredor">
              <Pressable
                accessibilityLabel="Invitar corredor"
                className="h-9 w-9 items-center justify-center rounded-full bg-primary active:opacity-80"
                nativeID="team-detail-invite-button"
                onPress={() => setInviteModalVisible(true)}
                testID="team-detail-invite-button"
              >
                <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={20} />
              </Pressable>
            </IconTooltip>
          </View>
        )}
        icon="account-multiple"
        title="Corredores"
      >
        {/* Sin corredores en el equipo (todavía, no por filtro) no tiene
            sentido mostrar el buscador — no hay nada para buscar. */}
        {(loadingRoster || members.length > 0) && (
          <View className="mb-4 rounded-xl bg-slate-50 p-1 dark:bg-slate-800" nativeID="team-detail-search-row" testID="team-detail-search-row">
            {/* Buscadores minimalistas (mismo criterio que
                ExercisesCatalogTab): sin label propio, el texto vive como
                placeholder adentro del campo — ninguno de los dos necesita
                ya alinearse contra un label del otro, así que da lo mismo
                ancho web o mobile angosto. InlinePicker (no
                ResponsiveSelectField) para "Grupo" porque ya viene sin
                label ni fila de error, pensado justo para esto. */}
            <Row narrowClassName="gap-3.5">
              <Col>
                <View className="h-12 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900" nativeID="team-detail-search-input-wrapper" testID="team-detail-search-input-wrapper">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={18} />
                  <TextInput
                    className="flex-1 text-sm text-slate-900 outline-none dark:text-white"
                    nativeID="team-detail-search-input"
                    onChangeText={setSearch}
                    placeholder={isTrainerView ? 'Buscar corredor por nombre o mail' : 'Buscar corredor por nombre'}
                    placeholderTextColor={colors.onSurfaceVariant}
                    testID="team-detail-search-input"
                    value={search}
                  />
                </View>
              </Col>
              {canSeeGroups && (
                <Col>
                  <InlinePicker onChange={setGroupFilter} options={groupOptions} placeholder="Buscar por grupo" scope="team-detail-group-filter" textClassName="text-sm" value={groupFilter} widthClass="w-full" />
                </Col>
              )}
            </Row>
          </View>
        )}

        {loadingRoster ? (
          <View className="gap-2" nativeID="team-detail-runners-loading" testID="team-detail-runners-loading">
            {[0, 1, 2].map((i) => (
              <View className="flex-row items-center gap-3 px-4 py-3" key={i} nativeID={`team-detail-runners-loading-row-${i}`} testID={`team-detail-runners-loading-row-${i}`}>
                <SkeletonCircle nativeID={`team-detail-runners-loading-row-${i}-avatar`} size={36} testID={`team-detail-runners-loading-row-${i}-avatar`} />
                <SkeletonBlock height={14} nativeID={`team-detail-runners-loading-row-${i}-name`} testID={`team-detail-runners-loading-row-${i}-name`} width="50%" />
              </View>
            ))}
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
                groupName={groups.find((g) => g.id === member.groupId)?.name ?? '—'}
                key={member.id}
                member={member}
                onOpenDetail={handleOpenRunnerDetail}
                onOpenMenu={handleOpenRunnerMenu}
                restricted={!isTrainerView}
                showGroupTag={canSeeGroups}
              />
            ))}
          </View>
        )}
      </SectionCard>
    </View>
  );

  // La pestaña/sección Grupos entera queda oculta para un corredor común
  // — no solo el tag de grupo por corredor (eso lo maneja el toggle
  // showGroupsToRunners), acá no hay excepción posible.
  const gruposContent = isTrainerView && (
    <SectionCard
      variant="nested"
      headerRight={canManageTeam && (
        <IconTooltip idPrefix="team-detail-add-group-button-tooltip" label="Agregar grupo">
        <Pressable
          accessibilityLabel="Agregar grupo"
          className="h-9 w-9 items-center justify-center rounded-full bg-primary active:opacity-80"
          nativeID="team-detail-add-group-button"
          onPress={() => setCreateGroupModalVisible(true)}
          testID="team-detail-add-group-button"
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={20} />
        </Pressable>
        </IconTooltip>
      )}
      icon="account-group"
      title="Grupos"
    >
      <View className="gap-2" nativeID="team-detail-groups-list" testID="team-detail-groups-list">
        {[...groups].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)).map((group) => (
          <GroupRow
            canEdit={canManageTeam && !group.isDefault}
            canManageTeam={canManageTeam}
            colors={colors}
            deleting={deletingGroupId === group.id}
            group={group}
            key={group.id}
            members={members.filter((m) => m.groupId === group.id)}
            onDelete={() => setGroupPendingDelete(group)}
            onEdit={() => router.push(`/teams/${team.id}/groups/${group.id}/edit`)}
            onViewCalendar={() => router.push(`/teams/${team.id}/groups/${group.id}/calendar`)}
          />
        ))}
      </View>
    </SectionCard>
  );

  const visibleTabs = TABS.filter((tab) => tab.id !== 'grupos' || isTrainerView);
  const leaderboardContent = <LeaderboardTab teamId={team.id} />;
  const competitionsContent = (
    <CompetitionsTab currentUserId={String(user?.userId)} focusCompetitionId={focusCompetitionId} groups={groupOptions} isTrainerView={isTrainerView} members={members} scrollViewRef={scrollViewRef} teamId={team.id} teamName={team.name} />
  );

  return (
    <View className="relative flex-1" nativeID="team-detail-screen-root" ref={runnerMenuContainerRef} testID="team-detail-screen-root">
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="team-detail-screen-scroll"
      ref={scrollViewRef}
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
      testID="team-detail-screen-scroll"
    >
      <ScreenCard nativeID="team-detail-screen-container" testID="team-detail-screen-container">
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
            idPrefix="team-detail-photo"
            loading={iconUploading}
            onPick={canDeleteTeam ? handlePickIcon : undefined}
            onRemove={canDeleteTeam ? handleRemoveIcon : undefined}
            placeholder="team"
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
          {/* "Sobre el equipo" -- antes la pestaña General, ahora un modal.
              Visible para cualquiera (no gateado por canManageTeam): la
              info del equipo no es solo para quien lo gestiona. */}
          <IconTooltip idPrefix="team-detail-info-button-tooltip" label="Sobre el equipo">
            <Pressable
              accessibilityLabel="Sobre el equipo"
              className="rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID="team-detail-info-button"
              onPress={() => setInfoModalVisible(true)}
              testID="team-detail-info-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="information-outline" size={20} />
            </Pressable>
          </IconTooltip>
          {canManageTeam && (
            <IconTooltip idPrefix="team-detail-edit-button-tooltip" label="Editar equipo">
              <Pressable
                accessibilityLabel="Editar equipo"
                className="h-9 w-9 items-center justify-center rounded-full bg-primary active:opacity-80"
                nativeID="team-detail-edit-button"
                onPress={() => router.push(`/teams/${team.id}/edit`)}
                testID="team-detail-edit-button"
              >
                <MaterialCommunityIcons color={colors.onPrimary} name="pencil-outline" size={20} />
              </Pressable>
            </IconTooltip>
          )}
          {canDeleteTeam && (
            <IconTooltip idPrefix="team-detail-delete-button-tooltip" label="Eliminar equipo">
              <Pressable
                accessibilityLabel="Eliminar equipo"
                className="rounded-full p-2 hover:bg-red-50 active:opacity-70 dark:hover:bg-red-900/20"
                nativeID="team-detail-delete-button"
                onPress={() => setDeleteModalVisible(true)}
                testID="team-detail-delete-button"
              >
                <MaterialCommunityIcons color={colors.error} name="trash-can-outline" size={20} />
              </Pressable>
            </IconTooltip>
          )}
          {!isTrainerView && canLeaveGroup && (
            <IconTooltip idPrefix="team-detail-leave-group-button-tooltip" label="Salir del grupo">
              <Pressable
                accessibilityLabel="Salir del grupo"
                className="rounded-full p-2 hover:bg-red-50 active:opacity-70 dark:hover:bg-red-900/20"
                nativeID="team-detail-leave-group-button"
                onPress={() => setLeaveGroupModalVisible(true)}
                testID="team-detail-leave-group-button"
              >
                <MaterialCommunityIcons color={colors.error} name="exit-run" size={20} />
              </Pressable>
            </IconTooltip>
          )}
        </View>

        {showSubscriptionBanner && (
          <TeamSubscriptionPendingBanner
            hasDebt={hasDebt}
            isPendingFirstPayment={isPendingFirstPayment}
            membershipFee={team.membershipFee}
            nextInstallment={nextInstallment}
            // Con una cuota abierta, "Pagar" abre el checkout directo, igual que en
            // el Home y en Pagos (`?pay=1`); sin cuota, solo lleva a la pantalla.
            onPay={() => router.push(nextInstallment
              ? { pathname: '/teams/[teamId]/subscription', params: { teamId: String(team.id), pay: '1' } }
              : `/teams/${team.id}/subscription`)}
          />
        )}

        <TabBar active={activeTab} badges={{ competencias: competitionsHasUnseen, corredores: hasPendingRequests }} onChange={setActiveTab} scope="team-detail-tab-bar" tabs={visibleTabs} />
        {activeTab === 'corredores' && corredoresContent}
        {activeTab === 'grupos' && gruposContent}
        {activeTab === 'leaderboard' && leaderboardContent}
        {activeTab === 'competencias' && competitionsContent}
        {activeTab === 'rendimiento' && <DashboardScreen teamId={team.id} />}
      </ScreenCard>

      <TeamInfoModal
        description={team.description}
        onClose={() => setInfoModalVisible(false)}
        ownerName={ownerName}
        requirements={team.requirements}
        visible={infoModalVisible}
      />

      <RunnerDetailModal
        groupName={groups.find((g) => g.id === runnerDetailMember?.groupId)?.name ?? '—'}
        joinedAt={runnerDetailMember?.joinedAt}
        onClose={() => setRunnerDetailMember(null)}
        userId={runnerDetailMember?.userId}
        visible={Boolean(runnerDetailMember)}
      />

      {canDeleteTeam && (
        <DeleteTeamModal
          onCancel={() => setDeleteModalVisible(false)}
          onConfirm={handleConfirmDelete}
          teamName={team.name}
          visible={deleteModalVisible}
        />
      )}

      {canManageTeam && (
        <DeleteGroupModal
          groupName={groupPendingDelete?.name}
          onCancel={() => setGroupPendingDelete(null)}
          onConfirm={() => handleDeleteGroup(groupPendingDelete)}
          visible={!!groupPendingDelete}
        />
      )}

      {canManageTeam && (
        <CreateGroupModal
          existingNames={groups.map((g) => g.name.toLowerCase())}
          onClose={() => setCreateGroupModalVisible(false)}
          onSubmit={async ({ name, description }) => {
            const result = await createGroupInTeam({ name, description });
            if (result.success) Toast.show({ type: 'success', text1: 'Grupo creado' });
            return result;
          }}
          visible={createGroupModalVisible}
        />
      )}

      {canManageTeam && (
        <InviteMemberModal
          existingEmails={members.map((m) => m.email)}
          groups={groups}
          onClose={() => setInviteModalVisible(false)}
          onSubmit={async ({ email, groupId }) => {
            const result = await sendInvite({ teamId: team.id, email, groupId });
            if (result.success) Toast.show({ type: 'success', text1: 'Invitación enviada' });
            return result;
          }}
          visible={inviteModalVisible}
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
            groups={groups}
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
      <RunnerActionsMenu member={runnerMenuMember} onDetail={handleOpenRunnerDetail} onExpel={handleRequestExpel} onMove={handleRequestMove} />
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

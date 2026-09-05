import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { useAddressCascade } from '../../hooks/use-address-cascade.js';
import { useTeamSearch } from '../../hooks/use-team-search.js';
import { useMyJoinRequests, useJoinRequestMutations } from '../../hooks/use-join-requests.js';
import { getCountryName, getProvinceName } from '../../data/locations.js';
import { SectionCard } from '../forms/section-card.jsx';
import { PickerField, SelectField, Row, Col } from '../forms/fields.jsx';
import { LEVEL_OPTIONS } from './team-general-info-fields.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

function buttonState(team, myPendingTeamIds) {
  if (myPendingTeamIds.has(team.id)) return { disabled: true, label: 'Solicitud enviada' };
  if (!team.isPublic) return { disabled: true, label: 'No acepta solicitudes' };
  if (team.memberCount >= team.maxMembers) return { disabled: true, label: 'Equipo completo' };
  return { disabled: false, label: 'Solicitar unirse' };
}

function TeamSearchResultCard({ team, onRequest, requesting }) {
  const colors = useThemeColors();
  const idPrefix = `team-search-result-${team.id}`;
  const locationLine = [team.city, team.province ? getProvinceName(team.country, team.province) : null, team.country ? getCountryName(team.country) : null].filter(Boolean).join(', ');

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <AvatarPicker fallbackIcon="account-group" idPrefix={`${idPrefix}-avatar`} size={44} uri={team.iconUrl} />
      <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`}>
          {team.name}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-meta`} testID={`${idPrefix}-meta`}>
          {LEVEL_OPTIONS.find((l) => l.id === team.level)?.name ?? team.level ?? '—'} · {locationLine || '—'} · {team.memberCount}/{team.maxMembers}
        </Text>
        {team.ownerName && (
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-owner`} testID={`${idPrefix}-owner`}>
            Entrenador: {team.ownerName}
          </Text>
        )}
      </View>
      {(() => {
        const state = buttonState(team, onRequest.myPendingTeamIds);
        return (
          <Pressable
            className={`h-10 flex-row items-center justify-center rounded-full px-4 ${state.disabled ? 'bg-slate-200 dark:bg-slate-700' : 'bg-primary hover:opacity-90 active:opacity-80'}`}
            disabled={state.disabled || requesting}
            nativeID={`${idPrefix}-request-button`}
            onPress={() => onRequest.handle(team.id)}
            testID={`${idPrefix}-request-button`}
          >
            {requesting ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
              <Text className={`text-xs font-semibold uppercase tracking-wide ${state.disabled ? 'text-slate-500 dark:text-slate-400' : 'text-[#111518]'}`} nativeID={`${idPrefix}-request-button-label`} testID={`${idPrefix}-request-button-label`}>
                {state.label}
              </Text>
            )}
          </Pressable>
        );
      })()}
    </View>
  );
}

function TeamSearchScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const address = useAddressCascade();
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const { results, hasMore, loading, search, loadMore } = useTeamSearch();
  const { requests: myRequests } = useMyJoinRequests();
  const { createJoinRequest, isCreating } = useJoinRequestMutations();
  const [requestingTeamId, setRequestingTeamId] = useState(null);
  const [searched, setSearched] = useState(false);

  // Un equipo que el usuario ya administra o integra nunca debería
  // aparecer como resultado de búsqueda — el backend ya excluye "donde el
  // caller ya es miembro" (ver spec, confirmado 2026-09-05), pero no está
  // confirmado si eso cubre también al dueño (el owner puede no estar
  // trackeado como team_user en todos los casos). Filtro client-side
  // como red de seguridad, sin depender de que el backend lo resuelva.
  const user = useAuthStore((s) => s.user);
  const teams = useTeamStore((s) => s.teams);
  const fetchTeams = useTeamStore((s) => s.fetchTeams);
  const myMemberTeams = useTeamStore((s) => s.myMemberTeams);
  const fetchMyMemberTeams = useTeamStore((s) => s.fetchMyMemberTeams);

  useEffect(() => {
    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?.userId) return;
    fetchMyMemberTeams(user.userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  const administeredTeams = selectAdministeredTeams(teams, user?.userId);
  const excludedTeamIds = new Set([...administeredTeams.map((t) => t.id), ...myMemberTeams.map((t) => t.id)]);
  const visibleResults = results.filter((team) => !excludedTeamIds.has(team.id));

  const myPendingTeamIds = new Set(myRequests.filter((r) => r.status === 'pending').map((r) => r.teamId));

  const handleSearch = () => {
    setSearched(true);
    search({ name: name.trim() || undefined, level: level || undefined, country: address.country || undefined, province: address.province || undefined, city: address.city || undefined });
    setFiltersCollapsed(true);
  };

  const handleRequest = async (teamId) => {
    setRequestingTeamId(teamId);
    try {
      await createJoinRequest(teamId);
      Toast.show({ type: 'success', text1: 'Solicitud enviada' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos enviar la solicitud', text2: error.message });
    }
    setRequestingTeamId(null);
  };

  return (
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="team-search-screen-scroll" showsVerticalScrollIndicator={false} testID="team-search-screen-scroll">
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="team-search-screen-container" testID="team-search-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="team-search-screen-header" testID="team-search-screen-header">
          <Pressable className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70" nativeID="team-search-screen-back-button" onPress={() => router.back()} testID="team-search-screen-back-button">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="team-search-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="team-search-screen-title">
            Buscar equipos
          </Text>
        </View>

        <SectionCard collapsed={filtersCollapsed} collapsible icon="magnify" onToggle={() => setFiltersCollapsed((v) => !v)} title="Filtros">
          <View className="flex-row items-center gap-2" nativeID="team-search-quick-row" testID="team-search-quick-row">
            <View className="h-11 flex-1 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900" nativeID="team-search-name-wrapper" testID="team-search-name-wrapper">
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={18} />
              <TextInput
                className="flex-1 text-sm text-slate-900 outline-none dark:text-white"
                nativeID="team-search-name-input"
                onChangeText={setName}
                placeholder="Buscar por nombre"
                placeholderTextColor={colors.onSurfaceVariant}
                testID="team-search-name-input"
                value={name}
              />
            </View>
            <Pressable
              accessibilityLabel={advancedOpen ? 'Ocultar filtros avanzados' : 'Mostrar filtros avanzados'}
              className={`h-11 w-11 items-center justify-center rounded-xl border ${advancedOpen ? 'border-primary bg-primary-tint dark:bg-primary/15' : 'border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'}`}
              nativeID="team-search-advanced-toggle"
              onPress={() => setAdvancedOpen((v) => !v)}
              testID="team-search-advanced-toggle"
            >
              <MaterialCommunityIcons color={advancedOpen ? colors.primary : colors.onSurfaceVariant} name="tune-variant" size={20} />
            </Pressable>
            <Pressable
              accessibilityLabel="Buscar"
              className="h-11 w-11 items-center justify-center rounded-xl bg-primary hover:opacity-90 active:opacity-80"
              nativeID="team-search-submit-button"
              onPress={handleSearch}
              testID="team-search-submit-button"
            >
              <MaterialCommunityIcons color={colors.onPrimary} name="magnify" size={20} />
            </Pressable>
          </View>

          {advancedOpen && (
            <View className="mt-3" nativeID="team-search-advanced-fields" testID="team-search-advanced-fields">
              <Row>
                <Col>
                  <PickerField dense label="Nivel" onChange={setLevel} options={LEVEL_OPTIONS} placeholder="Cualquiera" value={level} />
                </Col>
                <Col>
                  {isWeb ? (
                    <SelectField dense label="País" onChange={address.handleCountryChange} options={address.countryOptions} placeholder="Cualquiera" value={address.country} />
                  ) : (
                    <PickerField dense label="País" onChange={address.handleCountryChange} options={address.countryOptions} placeholder="Cualquiera" value={address.country} />
                  )}
                </Col>
              </Row>
              <Row>
                <Col>
                  {isWeb ? (
                    <SelectField dense disabled={!address.country} label="Provincia" onChange={address.handleProvinceChange} options={address.provinceOptions} placeholder={address.country ? 'Cualquiera' : 'Elegí un país'} value={address.province} />
                  ) : (
                    <PickerField dense disabled={!address.country} label="Provincia" onChange={address.handleProvinceChange} options={address.provinceOptions} placeholder={address.country ? 'Cualquiera' : 'Elegí un país'} value={address.province} />
                  )}
                </Col>
                <Col>
                  {isWeb ? (
                    <SelectField dense disabled={!address.province} label="Localidad" onChange={address.handleCityChange} options={address.cityOptions} placeholder={address.province ? 'Cualquiera' : 'Elegí una provincia'} value={address.city} />
                  ) : (
                    <PickerField dense disabled={!address.province} label="Localidad" onChange={address.handleCityChange} options={address.cityOptions} placeholder={address.province ? 'Cualquiera' : 'Elegí una provincia'} value={address.city} />
                  )}
                </Col>
              </Row>
            </View>
          )}
        </SectionCard>

        {searched && (
          loading && visibleResults.length === 0 ? (
            <View className="items-center py-6" nativeID="team-search-loading" testID="team-search-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : visibleResults.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="team-search-empty" testID="team-search-empty">
              No encontramos equipos con esos filtros.
            </Text>
          ) : (
            <>
              <View className="gap-2" nativeID="team-search-results-list" testID="team-search-results-list">
                {visibleResults.map((team) => (
                  <TeamSearchResultCard
                    key={team.id}
                    onRequest={{ handle: handleRequest, myPendingTeamIds }}
                    requesting={isCreating && requestingTeamId === team.id}
                    team={team}
                  />
                ))}
              </View>
              {hasMore && (
                <Pressable
                  className="mt-4 h-10 flex-row items-center justify-center gap-2 self-center rounded-full border border-slate-200 px-6 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:hover:bg-slate-800"
                  disabled={loading}
                  nativeID="team-search-load-more-button"
                  onPress={loadMore}
                  testID="team-search-load-more-button"
                >
                  {loading ? <ActivityIndicator color={colors.onSurfaceVariant} size="small" /> : (
                    <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="team-search-load-more-button-label" testID="team-search-load-more-button-label">
                      Cargar más
                    </Text>
                  )}
                </Pressable>
              )}
            </>
          )
        )}
      </View>
    </ScrollView>
  );
}

export function TeamSearchScreen() {
  return (
    <RequireAuth>
      <TeamSearchScreenContent />
    </RequireAuth>
  );
}

import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ACCORDION_CONFIG = { duration: 220, easing: Easing.out(Easing.cubic) };

// Ítem "Equipos" de un drawer de navegación: acordeón que expande/contrae
// la lista de equipos. Puramente presentacional (Reanimated +
// View/Pressable/Text, nada nativo-específico) — compartido a propósito
// entre AppMobileShell (nativo) y AppWebShellNarrow (web angosto), ver
// docs/superpowers/specs/2026-07-23-responsive-web-shell-design.md.
//
// Usa las animaciones de entrada/salida de Reanimated (maneja la
// transición de altura sola al montar/desmontar, más confiable que medir
// con onLayout y animar una altura manual) y rota un único ícono de
// chevron en vez de intercambiar dos íconos.
// El estado "expandido" usa un highlight neutro (no el verde de ruta
// activa) — si estuviera en la misma paleta que una ruta activa, con el
// acordeón abierto en home parecería que hay dos accesos seleccionados a
// la vez (mismo bug ya corregido en el header web ancho).
//
// onCreateTeam es opcional: sin ese callback (usuario sin rol entrenador)
// la fila "Crear equipo" ni se muestra.
export function TeamsAccordion({ expanded, onToggle, teams, selectedTeamId, onSelectTeam, onCreateTeam, colors, icon, label }) {
  const rotation = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    rotation.value = withTiming(expanded ? 1 : 0, ACCORDION_CONFIG);
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 180])}deg` }],
  }));

  return (
    <View nativeID="teams-accordion" testID="teams-accordion">
      <Pressable
        className={`mb-0.5 flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:opacity-90 ${
          expanded ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        nativeID="teams-accordion-toggle"
        onPress={onToggle}
        testID="teams-accordion-toggle"
      >
        <MaterialCommunityIcons
          color={colors.onSurfaceVariant}
          name={icon ?? 'circle-small'}
          size={22}
        />
        <Text className="flex-1 text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="teams-accordion-label" testID="teams-accordion-label">
          {label}
        </Text>
        <Animated.View nativeID="teams-accordion-chevron" style={chevronStyle} testID="teams-accordion-chevron">
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-down" size={18} />
        </Animated.View>
      </Pressable>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          layout={LinearTransition.duration(200)}
          nativeID="teams-accordion-content"
          testID="teams-accordion-content"
        >
          <View className="ml-6 gap-0.5 border-l border-slate-200 pl-3 dark:border-slate-800" nativeID="teams-accordion-list" testID="teams-accordion-list">
            {teams.length === 0 && (
              <Text
                className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400"
                nativeID="teams-accordion-empty"
                testID="teams-accordion-empty"
              >
                Todavía no tenés equipos.
              </Text>
            )}
            {teams.map((team) => {
              const isSelected = team.id === selectedTeamId;
              return (
                <Pressable
                  key={team.id}
                  className="flex-row items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-100 active:opacity-80 dark:hover:bg-slate-800"
                  nativeID={`teams-accordion-team-${team.id}`}
                  onPress={() => onSelectTeam(team)}
                  testID={`teams-accordion-team-${team.id}`}
                >
                  <MaterialCommunityIcons
                    color={isSelected ? colors.primary : colors.onSurfaceVariant}
                    name="account-group"
                    size={16}
                  />
                  <Text
                    className={`flex-1 text-sm ${isSelected ? 'font-semibold text-primary' : 'text-slate-600 dark:text-slate-300'}`}
                    nativeID={`teams-accordion-team-label-${team.id}`}
                    testID={`teams-accordion-team-label-${team.id}`}
                  >
                    {team.name}
                  </Text>
                </Pressable>
              );
            })}
            {onCreateTeam && (
              <Pressable
                className="flex-row items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-100 active:opacity-80 dark:hover:bg-slate-800"
                nativeID="teams-accordion-create"
                onPress={onCreateTeam}
                testID="teams-accordion-create"
              >
                <MaterialCommunityIcons color={colors.primary} name="plus-circle" size={16} />
                <Text className="text-sm font-semibold text-primary" nativeID="teams-accordion-create-label" testID="teams-accordion-create-label">Crear equipo</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

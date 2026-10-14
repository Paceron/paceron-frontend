import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DashboardState } from './state-shell.jsx';
import { useThemeColors } from '../../theme/colors.js';

// Primer uso: el equipo existe pero todavía no registró ninguna sesión, así que
// `/dashboard/filters` devuelve `date_range: null` —no es lo mismo que "hay datos
// acotados", y el front usa esa diferencia para no mostrar un rango inventado.
//
// La pantalla guía a los dos pasos que desbloquean el resto: elegir grupo y tipo
// de ejercicio. Es el único estado que explica qué hacer antes de que exista el
// dato, en vez de describir una ausencia.
const STEPS = [
  { id: 'group', icon: 'account-group-outline', label: 'Elegí un grupo del equipo' },
  { id: 'kind', icon: 'run-fast', label: 'Elegí un tipo de ejercicio' },
];

export function StateOnboarding({ id = 'dashboard-state-onboarding', onPickGroup, onPickKind }) {
  const colors = useThemeColors();

  return (
    <DashboardState
      icon="rocket-launch-outline"
      id={id}
      message="Registrá la primera sesión del equipo y acá vas a ver el rendimiento por ejercicio, con ritmo, cumplimiento y tendencia."
      title="Todavía no hay nada que medir"
      tone="info"
    >
      <View className="w-full gap-2" nativeID={`${id}-steps`} testID={`${id}-steps`}>
        {STEPS.map((step) => (
          <View
            className="flex-row items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700"
            key={step.id}
            nativeID={`${id}-step-${step.id}`}
            testID={`${id}-step-${step.id}`}
          >
            <MaterialCommunityIcons color={colors.primary} name={step.icon} size={18} />
            <Text className="flex-1 text-left text-xs text-slate-700 dark:text-slate-200" nativeID={`${id}-step-${step.id}-label`} testID={`${id}-step-${step.id}-label`}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>
      <View className="mt-3 flex-row gap-2" nativeID={`${id}-actions`} testID={`${id}-actions`}>
        <Text
          accessibilityRole="link"
          className="text-xs font-semibold text-primary"
          nativeID={`${id}-action-group`}
          onPress={onPickGroup}
          testID={`${id}-action-group`}
        >
          Elegir grupo
        </Text>
        <Text
          accessibilityRole="link"
          className="text-xs font-semibold text-primary"
          nativeID={`${id}-action-kind`}
          onPress={onPickKind}
          testID={`${id}-action-kind`}
        >
          Elegir tipo
        </Text>
      </View>
    </DashboardState>
  );
}

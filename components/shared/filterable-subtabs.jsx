import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TabBar } from './tab-bar.jsx';
import { useThemeColors } from '../../theme/colors.js';

// Compartido por CompetitionsTab (equipo) y MyCompetitionsTab (gamificación)
// -- pedido explícito de que las dos pantallas usen el MISMO mecanismo, no
// una reimplementación cada una. El borde `border-b-2` que antes vivía
// adentro de TabBar variant="compact" se MUEVE a este contenedor: TabBar
// sigue sin cambios, se le pasa un wrapClassName "pelado" (sin su propio
// borde/redondeo) para que el marco no se dibuje dos veces.
export function FilterableSubtabs({ tabs, active, onChange, badges, scope, filterCount = 0, filterContent }) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="mb-4 rounded-xl border-b-4 border-slate-300 dark:border-slate-700" nativeID={`${scope}-frame`} testID={`${scope}-frame`}>
      <View className="flex-row items-center gap-2 px-3 py-1.5" nativeID={`${scope}-row`} testID={`${scope}-row`}>
        <TabBar active={active} badges={badges} onChange={onChange} scope={scope} tabs={tabs} variant="compact" wrapClassName="flex-1 flex-row gap-4 mb-2" />
        <Pressable
          accessibilityLabel={expanded ? 'Ocultar filtros' : 'Mostrar filtros'}
          accessibilityRole="button"
          className="flex-row items-center gap-1 rounded-full px-2.5 py-1 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID={`${scope}-filter-toggle`}
          onPress={() => setExpanded((v) => !v)}
          testID={`${scope}-filter-toggle`}
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="filter-variant" size={18} />
          {filterCount > 0 && (
            <Text className="text-xs font-semibold text-primary" nativeID={`${scope}-filter-count`} testID={`${scope}-filter-count`}>{filterCount}</Text>
          )}
        </Pressable>
      </View>
      {expanded && (
        <View className="px-3 pb-3" nativeID={`${scope}-filter-panel`} testID={`${scope}-filter-panel`}>
          {filterContent}
        </View>
      )}
    </View>
  );
}

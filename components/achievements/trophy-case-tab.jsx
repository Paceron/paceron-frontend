import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useStamps } from '../../hooks/use-stamps.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { isWeb } from '../../utils/platform.js';

function StampGrid({ items, idPrefix, columnClass, large = false }) {
  if (!items.length) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-empty`} testID={`${idPrefix}-empty`}>Todavía no hay nada acá.</Text>;
  }

  return (
    <View className="flex-row flex-wrap gap-3" nativeID={idPrefix} testID={idPrefix}>
      {items.map((stamp) => {
        const itemPrefix = `${idPrefix}-item-${stamp.id}`;
        return (
          <View className={`${columnClass} items-center rounded-2xl bg-white p-3 shadow-sm dark:bg-surface ${large ? 'py-5' : ''}`} key={stamp.id} nativeID={itemPrefix} testID={itemPrefix}>
            <MaterialCommunityIcons color="#ca8a04" name={stamp.iconKey} size={large ? 32 : 22} />
            <Text className="mt-1 text-center text-xs font-medium text-slate-700 dark:text-slate-200" nativeID={`${itemPrefix}-name`} numberOfLines={2} testID={`${itemPrefix}-name`}>
              {stamp.sourceName}
            </Text>
            {stamp.count > 1 && (
              <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID={`${itemPrefix}-count`} testID={`${itemPrefix}-count`}>
                x{stamp.count}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function TrophyCaseTab() {
  const { counters, competitions, loading, error } = useStamps();
  const isNarrowWeb = useIsNarrowWeb();
  const columnClass = !isWeb || isNarrowWeb ? 'w-[30%]' : 'w-[22%]';

  if (loading) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="trophy-case-tab-loading" testID="trophy-case-tab-loading">Cargando…</Text>;
  }

  if (error) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="trophy-case-tab-error" testID="trophy-case-tab-error">No pudimos cargar tu vitrina.</Text>;
  }

  return (
    <View nativeID="trophy-case-tab-root" testID="trophy-case-tab-root">
      <Text className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="trophy-case-tab-counters-title" testID="trophy-case-tab-counters-title">
        Estampas
      </Text>
      <StampGrid columnClass={columnClass} idPrefix="trophy-case-tab-counters" items={counters} />
      <Text className="mb-2 mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="trophy-case-tab-competitions-title" testID="trophy-case-tab-competitions-title">
        Trofeos de competencias
      </Text>
      <StampGrid columnClass={columnClass} idPrefix="trophy-case-tab-competitions" items={competitions} large />
    </View>
  );
}

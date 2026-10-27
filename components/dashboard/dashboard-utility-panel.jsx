import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { TabBar } from '../shared/tab-bar.jsx';

// Filtros y Calidad de los datos en UN panel con dos pestañas al mismo nivel.
//
// Hasta 2026-10-23 eran dos `FilterPanel` hermanos: cada uno con su card, su
// chevron y su badge. Funcionaba, pero ocupaba dos tarjetas para dos preguntas
// que se consultan juntas —qué estoy mirando y si los datos alcanzan— y dejaba
// el panel abierto por defecto en una pantalla que ya tiene mucho contenido.
// Ahora hay un solo panel, arranca MINIMIZADO y las dos preguntas se alternan
// como pestañas. El header sigue mostrando cada conteo por separado (nunca un
// badge combinado "3 avisos · 2 filtros", que mezclaba las dos preguntas).
//
// El contenido de cada pestaña lo arma la pantalla: acá no se conocen ni el
// formulario de filtros ni el bloque de calidad. Eso permite que el mismo panel
// siga sirviendo si mañana se suma una tercera pestaña, sin mover la lógica de
// filtros ni la de calidad.
export function DashboardUtilityPanel({
  id = 'dashboard-utility',
  filtersContent,
  qualityContent,
  filterCount = 0,
  qualityBadge = null,
  meta = null,
  onOpenFilters = () => {},
}) {
  const colors = useThemeColors();
  const narrow = useIsNarrowWeb();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('filters');

  const tabs = [
    {
      id: 'filters',
      label: filterCount ? `Filtros · ${filterCount}` : 'Filtros',
      icon: 'filter-variant',
    },
    {
      id: 'quality',
      label: qualityBadge ? `Calidad · ${qualityBadge}` : 'Calidad de datos',
      icon: 'alert-outline',
    },
  ];
  const current = tabs.some((tab) => tab.id === active) ? active : 'filters';

  // Las pestañas también abren el panel: tocar la activa mientras está abierto
  // lo cierra, y tocar la otra cambia de contenido sin cerrarlo. Así el gesto
  // de "quiero ver esto" no obliga a apuntar después al chevron.
  const selectTab = (tabId) => {
    if (narrow && tabId === 'filters') {
      setActive('filters');
      setOpen(false);
      onOpenFilters();
      return;
    }
    if (tabId === current && open) {
      setOpen(false);
      return;
    }
    setActive(tabId);
    setOpen(true);
  };

  return (
    <View
      className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface"
      nativeID={`${id}-root`}
      testID={`${id}-root`}
    >
      <View className="flex-row items-start gap-2" nativeID={`${id}-header`} testID={`${id}-header`}>
        <View className="flex-1" nativeID={`${id}-tabs-slot`} testID={`${id}-tabs-slot`}>
          <TabBar
            active={current}
            onChange={selectTab}
            scope={`${id}-tabs`}
            tabs={tabs}
            wrapClassName="flex-row flex-wrap gap-2"
          />
        </View>
        {(!narrow || current === 'quality') ? <Pressable
          accessibilityHint={open ? 'Oculta el contenido del panel' : 'Muestra el contenido del panel'}
          accessibilityLabel={open ? 'Minimizar filtros y calidad' : 'Maximizar filtros y calidad'}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          className="h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          hitSlop={8}
          nativeID={`${id}-toggle`}
          onPress={() => setOpen((value) => !value)}
          testID={`${id}-toggle`}
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name={open ? 'chevron-up' : 'chevron-down'} size={20} />
        </Pressable> : null}
      </View>

      {meta ? (
        <Text
          className="mt-1 text-[11px] text-slate-500 dark:text-slate-400"
          nativeID={`${id}-meta`}
          numberOfLines={1}
          testID={`${id}-meta`}
        >
          {meta}
        </Text>
      ) : null}

      {open && !(narrow && current === 'filters') ? (
        <View className="mt-3" nativeID={`${id}-content`} testID={`${id}-content`}>
          {current === 'filters' ? filtersContent : qualityContent}
        </View>
      ) : null}
    </View>
  );
}

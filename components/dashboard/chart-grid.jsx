import { Children, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { ChartCard } from './charts/chart-surface.jsx';

// Grilla de gráficos del dashboard. Cada tarjeta arranca MINIMIZADA en una
// cuadrícula de dos columnas y se puede maximizar por separado; la barra de
// arriba permite maximizar o minimizar todas a la vez. El estado vive acá y no
// en cada tarjeta porque el control global necesita saber cuáles están abiertas
// — si cada una guardara su propio booleano, "todas" no tendría forma de
// alcanzarlas sin duplicar el estado en dos lugares.
//
// La expansión NO es un modal: la tarjeta pasa a ocupar el ancho completo de la
// grilla y muestra el gráfico entero en el flujo de la página, así se pueden
// dejar dos o tres abiertas y compararlas sin cerrar la anterior. En ancho
// angosto siempre ocupa el ancho completo: dos columnas en un teléfono dejarían
// gráficos de 150 px.
const ChartGridContext = createContext(null);

export function ChartGrid({ id, ids = [], initialExpandedId = null, children }) {
  const colors = useThemeColors();
  const narrow = useIsNarrowWeb();
  const [expanded, setExpanded] = useState(() => (
    narrow && initialExpandedId && ids.includes(initialExpandedId) ? new Set([initialExpandedId]) : new Set()
  ));
  const anyExpanded = ids.some((itemId) => expanded.has(itemId));
  const allExpanded = ids.length > 0 && !ids.some((itemId) => !expanded.has(itemId));
  const visibleChildren = useMemo(() => {
    const items = Children.toArray(children);
    if (!narrow) return items;
    return items
      .map((child, index) => ({ child, index, order: child?.props?.mobileOrder ?? 0 }))
      .sort((a, b) => a.order - b.order || a.index - b.index)
      .map(({ child }) => child);
  }, [children, narrow]);

  const toggle = useCallback((itemId) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setExpanded(new Set(ids)), [ids]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const value = useMemo(() => ({ expanded, toggle }), [expanded, toggle]);

  return (
    <ChartGridContext.Provider value={value}>
      <View
        className="mb-2 flex-row items-center justify-between"
        nativeID={`${id}-header`}
        testID={`${id}-header`}
      >
        <View className="flex-row items-center gap-2" nativeID={`${id}-header-label`} testID={`${id}-header-label`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="view-grid-outline" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID={`${id}-title`} testID={`${id}-title`}>
            Gráficos
          </Text>
        </View>
        {ids.length ? (
          <View className="flex-row flex-wrap items-center justify-end gap-1" nativeID={`${id}-bulk-actions`} testID={`${id}-bulk-actions`}>
            {/* Dos acciones explícitas, no un único toggle: con dos tarjetas
                abiertas de cuatro, "Maximizar todos" no es lo mismo que
                "Minimizar todos" y un solo botón obligaba a expandir todo
                antes de poder cerrar todo. */}
            {!allExpanded ? (
              <Pressable
                accessibilityHint="Muestra todos los gráficos completos"
                accessibilityLabel="Maximizar todos los gráficos"
                accessibilityRole="button"
                className="flex-row items-center gap-1 rounded-full px-2 py-1 active:opacity-70"
                hitSlop={4}
                nativeID={`${id}-expand-all`}
                onPress={expandAll}
                testID={`${id}-expand-all`}
              >
                <MaterialCommunityIcons color={colors.primary} name="arrow-expand-all" size={14} />
                {narrow ? null : (
                  <Text className="text-[11px] font-semibold text-primary" nativeID={`${id}-expand-all-label`} testID={`${id}-expand-all-label`}>
                    Maximizar todos
                  </Text>
                )}
              </Pressable>
            ) : null}
            {anyExpanded ? (
              <Pressable
                accessibilityHint="Vuelve a la grilla de previews"
                accessibilityLabel="Minimizar todos los gráficos"
                accessibilityRole="button"
                className="flex-row items-center gap-1 rounded-full px-2 py-1 active:opacity-70"
                hitSlop={4}
                nativeID={`${id}-collapse-all`}
                onPress={collapseAll}
                testID={`${id}-collapse-all`}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-collapse-all" size={14} />
                {narrow ? null : (
                  <Text className="text-[11px] font-semibold text-slate-600 dark:text-slate-300" nativeID={`${id}-collapse-all-label`} testID={`${id}-collapse-all-label`}>
                    Minimizar todos
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View className="-mx-2 flex-row flex-wrap" nativeID={id} testID={id}>
        {visibleChildren}
      </View>
    </ChartGridContext.Provider>
  );
}

// Una tarjeta de la grilla. `children` es el gráfico completo y solo se monta
// cuando la tarjeta está maximizada; minimizada muestra `preview` (una línea con
// el dato que resume el gráfico) o directamente nada, para que el estado
// colapsado no ocupe más alto que su header. La flecha de cada tarjeta y el
// botón "todas" escriben en el mismo estado del `ChartGrid`.
export function ChartGridItem({
  id,
  title,
  icon = 'chart-line',
  description,
  subtitle,
  action = null,
  preview = null,
  children,
}) {
  const context = useContext(ChartGridContext);
  const narrow = useIsNarrowWeb();
  const colors = useThemeColors();
  const expanded = context?.expanded?.has(id) ?? false;

  return (
    <View
      className={`px-2 ${expanded || narrow ? 'w-full' : 'w-1/2'}`}
      nativeID={`${id}-slot`}
      testID={`${id}-slot`}
    >
      <ChartCard
        action={(
          <View className="flex-row items-center gap-2" nativeID={`${id}-actions`} testID={`${id}-actions`}>
            {expanded ? action : null}
            <Pressable
              accessibilityHint={expanded ? 'Vuelve a la grilla de dos columnas' : 'Muestra el gráfico completo'}
              accessibilityLabel={expanded ? `Minimizar ${title}` : `Maximizar ${title}`}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              className="h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              hitSlop={6}
              nativeID={`${id}-toggle`}
              onPress={() => context?.toggle(id)}
              testID={`${id}-toggle`}
            >
              <MaterialCommunityIcons
                color={colors.onSurfaceVariant}
                name={expanded ? 'arrow-collapse' : 'arrow-expand'}
                size={17}
              />
            </Pressable>
          </View>
        )}
        description={description}
        icon={icon}
        id={id}
        subtitle={expanded ? subtitle : undefined}
        title={title}
      >
        {expanded ? children : preview ? (
          <View className="mt-1" nativeID={`${id}-preview`} testID={`${id}-preview`}>
            {preview}
          </View>
        ) : null}
      </ChartCard>
    </View>
  );
}

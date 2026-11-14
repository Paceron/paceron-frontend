import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { metricHelp } from '../../utils/metric-help.js';

// Ventana de ayuda de una métrica. Es el "Más información" del tooltip: la
// explicación corta del bubble se queda en la tarjeta y acá va la larga, con
// ejemplos y tablas.
//
// Por qué un modal y no un tooltip más grande: el texto no entra en el ancho de
// una celda del dashboard ni se puede scrollear cómodo dentro de un bubble. El
// modal trae su propio ScrollView y se cierra con la X o tocando afuera.
//
// El contenido NO vive acá: sale de `utils/metric-help.js` (datos puros). Este
// componente solo decide cómo se ve cada bloque tipado (párrafo, fórmula, tabla,
// lista numerada, nota). Agregar una métrica es agregar una entrada allá.
//
// Con `metricId` nulo no se monta el Modal: las paletas lo dejan montado siempre
// y le pasan el id de la tarjeta abierta, así que el caso "cerrado" tiene que
// ser barato.
// La primera columna de las tablas es la etiqueta y necesita un poco más de
// ancho que las numéricas. Va en `style` y no en una clase arbitraria
// (`flex-[1.3]`) porque es la forma que funciona igual en web y en nativo.
const FIRST_COLUMN_STYLE = { flexBasis: 0, flexGrow: 1.3, flexShrink: 1 };

export function MetricHelpSheet({ metricId, onClose, id = 'metric-help' }) {
  const colors = useThemeColors();
  const metric = metricHelp(metricId);
  if (!metric) return null;

  return (
    <Modal
      accessibilityViewIsModal
      animationType="fade"
      nativeID={`${id}-modal`}
      onRequestClose={onClose}
      statusBarTranslucent
      testID={`${id}-modal`}
      transparent
      visible
    >
      <View
        className="flex-1 items-center justify-center px-3 py-6"
        nativeID={`${id}-root`}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.48)' }}
        testID={`${id}-root`}
      >
        <Pressable
          accessibilityLabel="Cerrar la ayuda"
          accessibilityRole="button"
          className="absolute inset-0"
          nativeID={`${id}-backdrop`}
          onPress={onClose}
          testID={`${id}-backdrop`}
        />
        {/* Mismo ancho que el panel central del dashboard/Home (`max-w-3xl`,
            768 px): la guía se lee como una capa sobre la pantalla y no como
            una hoja pegada al borde inferior. En mobile ocupa el ancho
            disponible menos el padding. */}
        <SafeAreaView
          className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-surface"
          edges={['top', 'bottom']}
          nativeID={`${id}-sheet`}
          style={{ maxHeight: '88%' }}
          testID={`${id}-sheet`}
        >
          {/* Encabezado fijo: el título y la X no se van con el scroll, que es
              lo que se espera de una ventana de lectura larga. */}
          <View
            className="flex-row items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700"
            nativeID={`${id}-header`}
            testID={`${id}-header`}
          >
            <MaterialCommunityIcons color={colors.primary} name="book-open-variant" size={19} />
            <Text
              className="flex-1 text-base font-bold text-slate-900 dark:text-white"
              nativeID={`${id}-title`}
              numberOfLines={2}
              testID={`${id}-title`}
            >
              {metric.title}
            </Text>
            <Pressable
              accessibilityLabel="Cerrar la ayuda"
              accessibilityRole="button"
              className="h-11 w-11 items-center justify-center rounded-full active:bg-slate-100 dark:active:bg-slate-800"
              hitSlop={4}
              nativeID={`${id}-close`}
              onPress={onClose}
              testID={`${id}-close`}
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={20} />
            </Pressable>
          </View>

          <ScrollView
            className="shrink"
            contentContainerClassName="px-4 pb-8 pt-4"
            nativeID={`${id}-scroll`}
            showsVerticalScrollIndicator
            testID={`${id}-scroll`}
          >
            <View
              className="w-full"
              nativeID={`${id}-body`}
              testID={`${id}-body`}
            >
              <Text
                className="text-sm leading-6 text-slate-700 dark:text-slate-200"
                nativeID={`${id}-summary`}
                testID={`${id}-summary`}
              >
                {metric.summary}
              </Text>

              {metric.sections.map((section, index) => renderSection(section, index, id))}

              <Text
                className="mt-6 text-[11px] leading-4 text-slate-500 dark:text-slate-400"
                nativeID={`${id}-footer`}
                testID={`${id}-footer`}
              >
                Los números se calculan en el servidor con los datos de tus series. Esta guía explica de dónde sale cada uno; no cambia ningún valor.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function renderSection(section, index, id) {
  const base = `${id}-section-${index}`;

  switch (section.kind) {
    case 'heading':
      return (
        <Text
          className="mt-5 text-[11px] font-bold uppercase tracking-wide text-green-800 dark:text-primary"
          key={base}
          nativeID={base}
          testID={base}
        >
          {section.text}
        </Text>
      );

    case 'formula':
      return (
        <View
          className="mt-2 rounded-xl border border-green-300 bg-green-50 px-3 py-2 dark:border-green-700 dark:bg-green-950/40"
          key={base}
          nativeID={base}
          testID={base}
        >
          <Text
            className="text-[13px] font-semibold leading-5 text-green-950 dark:text-green-100"
            nativeID={`${base}-text`}
            testID={`${base}-text`}
          >
            {section.text}
          </Text>
        </View>
      );

    case 'table':
      return (
        <View className="mt-3" key={base} nativeID={base} testID={base}>
          <View
            className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
            nativeID={`${base}-table`}
            testID={`${base}-table`}
          >
            <View
              className="flex-row bg-slate-100 dark:bg-slate-800"
              nativeID={`${base}-head`}
              testID={`${base}-head`}
            >
              {section.columns.map((column, columnIndex) => (
                <Text
                  className={`${columnIndex === 0 ? 'text-left' : 'flex-1 text-right'} px-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300`}
                  key={`${base}-column-${columnIndex}`}
                  nativeID={`${base}-column-${columnIndex}`}
                  style={columnIndex === 0 ? FIRST_COLUMN_STYLE : undefined}
                  testID={`${base}-column-${columnIndex}`}
                >
                  {column}
                </Text>
              ))}
            </View>
            {section.rows.map((row, rowIndex) => (
              <View
                className={`flex-row border-t border-slate-200 dark:border-slate-700 ${rowIndex % 2 === 1 ? 'bg-slate-50 dark:bg-slate-900/40' : ''}`}
                key={`${base}-row-${rowIndex}`}
                nativeID={`${base}-row-${rowIndex}`}
                testID={`${base}-row-${rowIndex}`}
              >
                {row.map((cell, cellIndex) => (
                  <Text
                    className={`${cellIndex === 0 ? 'text-left font-semibold' : 'flex-1 text-right'} px-1.5 py-1.5 text-[11px] leading-4 text-slate-800 dark:text-slate-100`}
                    key={`${base}-row-${rowIndex}-cell-${cellIndex}`}
                    nativeID={`${base}-row-${rowIndex}-cell-${cellIndex}`}
                    style={cellIndex === 0 ? FIRST_COLUMN_STYLE : undefined}
                    testID={`${base}-row-${rowIndex}-cell-${cellIndex}`}
                  >
                    {cell}
                  </Text>
                ))}
              </View>
            ))}
          </View>
          {section.note ? (
            <Text
              className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400"
              nativeID={`${base}-note`}
              testID={`${base}-note`}
            >
              {section.note}
            </Text>
          ) : null}
        </View>
      );

    case 'steps':
      return (
        <View className="mt-2 gap-2" key={base} nativeID={base} testID={base}>
          {section.items.map((item, itemIndex) => (
            <View
              className="flex-row gap-2"
              key={`${base}-item-${itemIndex}`}
              nativeID={`${base}-item-${itemIndex}`}
              testID={`${base}-item-${itemIndex}`}
            >
              <View
                className="mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-green-700 dark:bg-green-600"
                nativeID={`${base}-item-${itemIndex}-number`}
                testID={`${base}-item-${itemIndex}-number`}
              >
                <Text
                  className="text-[10px] font-bold text-white"
                  nativeID={`${base}-item-${itemIndex}-number-text`}
                  testID={`${base}-item-${itemIndex}-number-text`}
                >
                  {itemIndex + 1}
                </Text>
              </View>
              <Text
                className="flex-1 text-[13px] leading-5 text-slate-700 dark:text-slate-200"
                nativeID={`${base}-item-${itemIndex}-text`}
                testID={`${base}-item-${itemIndex}-text`}
              >
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      );

    case 'list':
      return (
        <View className="mt-2 gap-2" key={base} nativeID={base} testID={base}>
          {section.items.map((item, itemIndex) => (
            <View
              className="flex-row gap-2"
              key={`${base}-item-${itemIndex}`}
              nativeID={`${base}-item-${itemIndex}`}
              testID={`${base}-item-${itemIndex}`}
            >
              <Text
                className="text-[13px] leading-5 text-green-700 dark:text-primary"
                nativeID={`${base}-item-${itemIndex}-bullet`}
                testID={`${base}-item-${itemIndex}-bullet`}
              >
                •
              </Text>
              <Text
                className="flex-1 text-[13px] leading-5 text-slate-700 dark:text-slate-200"
                nativeID={`${base}-item-${itemIndex}-text`}
                testID={`${base}-item-${itemIndex}-text`}
              >
                {item.label ? (
                  <Text
                    className="font-semibold text-slate-900 dark:text-white"
                    nativeID={`${base}-item-${itemIndex}-label`}
                    testID={`${base}-item-${itemIndex}-label`}
                  >
                    {item.label}:{' '}
                  </Text>
                ) : null}
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      );

    case 'note':
      return (
        <View
          className="mt-3 rounded-xl border-l-2 border-green-600 bg-slate-50 px-3 py-2 dark:border-primary dark:bg-slate-800/60"
          key={base}
          nativeID={base}
          testID={base}
        >
          {section.title ? (
            <Text
              className="text-[11px] font-bold uppercase tracking-wide text-green-800 dark:text-primary"
              nativeID={`${base}-title`}
              testID={`${base}-title`}
            >
              {section.title}
            </Text>
          ) : null}
          <Text
            className="mt-0.5 text-[12px] leading-5 text-slate-700 dark:text-slate-200"
            nativeID={`${base}-text`}
            testID={`${base}-text`}
          >
            {section.text}
          </Text>
        </View>
      );

    case 'paragraph':
    default:
      return (
        <Text
          className="mt-2.5 text-[13px] leading-5 text-slate-700 dark:text-slate-200"
          key={base}
          nativeID={base}
          testID={base}
        >
          {section.text}
        </Text>
      );
  }
}

import { Text, View } from 'react-native';
import { complianceTone, formatCompliance } from '../../utils/comparison-format.js';

// Chip del % de cumplimiento coloreado por tono (utils/comparison-format.js):
// verde 90+, ámbar 50+, rojo debajo. Mismo par claro/oscuro en todas las
// pantallas de la comparación, por eso vive acá y no repetido por pantalla.
export const COMPLIANCE_TONE_CLASSES = {
  good: { bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  partial: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-300' },
  low: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300' },
};

// Colores del SVG del gráfico, mismo criterio que los chips.
export const COMPLIANCE_TONE_FILL = { good: '#8cc63e', partial: '#f59e0b', low: '#f43f5e' };

export function ComplianceBadge({ pct, size = 'sm', idPrefix }) {
  const tone = COMPLIANCE_TONE_CLASSES[complianceTone(pct)];
  const large = size === 'lg';
  return (
    <View className={`items-center justify-center rounded-full ${tone.bg} ${large ? 'px-4 py-1.5' : 'px-2.5 py-0.5'}`} nativeID={`${idPrefix}-badge`} testID={`${idPrefix}-badge`}>
      <Text className={`font-bold ${tone.text} ${large ? 'text-2xl' : 'text-xs'}`} nativeID={`${idPrefix}-badge-text`} testID={`${idPrefix}-badge-text`}>
        {formatCompliance(pct)}
      </Text>
    </View>
  );
}

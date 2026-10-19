import { View } from 'react-native';

// Barra de progreso simple, sin librería -- `View` con ancho proporcional.
// Compartida por achievements-tab.jsx y achievement-highlight-card.jsx.
export function ProgressBar({ percent, nativeID, testID }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700" nativeID={nativeID} testID={testID}>
      <View className="h-1.5 rounded-full bg-primary" nativeID={`${nativeID}-fill`} style={{ width: `${clamped}%` }} testID={`${nativeID}-fill`} />
    </View>
  );
}

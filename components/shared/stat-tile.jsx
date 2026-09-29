import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// El padding horizontal es más chico que el resto de las cards (px-1.5 en
// vez de p-4 parejo) porque las etiquetas más largas — "Entrenamientos
// realizados" en el detalle de equipo — necesitan ese ancho extra para
// partir en "Entrenamientos" / "realizados" en mobile (varios tiles
// angostos, flex-1). Sin esto, la palabra no entraba y se cortaba mitad de
// palabra en vez de partir prolijo entre las dos. text-[11px] en vez de
// text-xs (12px) da un margen extra por las dudas en pantallas más
// angostas — sin numberOfLines: se deja crecer a 2 líneas libremente, no
// se trunca.
//
// `idPrefix` es requerido a propósito: la regla `local/require-native-id`
// exige ids, y hardcodear un prefijo acá haría que dos tiles del mismo
// árbol colisionaran apenas aparece un segundo consumidor.
export function StatTile({ icon, label, value, colors, idPrefix }) {
  return (
    <View
      className="flex-1 items-center rounded-2xl border border-slate-200 bg-white px-1.5 py-4 dark:border-slate-700 dark:bg-surface"
      nativeID={`${idPrefix}-${label}`}
      testID={`${idPrefix}-${label}`}
    >
      <MaterialCommunityIcons color={colors.primary} name={icon} size={22} style={{ marginBottom: 6 }} />
      <Text className="text-xl font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-${label}-value`} testID={`${idPrefix}-${label}-value`}>
        {value}
      </Text>
      <Text className="text-center text-[11px] leading-4 text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-${label}-label`} testID={`${idPrefix}-${label}-label`}>
        {label}
      </Text>
    </View>
  );
}

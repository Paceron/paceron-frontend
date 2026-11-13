// Mapa real de glyphs de MaterialCommunityIcons -- importado directo del
// JSON interno que la librería usa para construir el componente
// (node_modules/@expo/vector-icons/.../glyphmaps/MaterialCommunityIcons.json,
// el mismo archivo que pasa a `createIconSet`), NO vía
// `import { MaterialCommunityIcons } from '@expo/vector-icons'`: ese
// barrel importa los OTROS sets de íconos también (AntDesign, etc.), que
// a su vez tocan `expo-font` al cargarse -- en Jest eso rompe con
// "Unexpected token 'export'" porque `expo-font` no está en
// `transformIgnorePatterns` (nadie había importado vector-icons desde un
// test puro antes; todo el resto de usos son en componentes, sin tests de
// render). El JSON no necesita transform -- Metro y Jest lo parsean
// nativo, sin pasar por ningún babel.
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

// Fallback para cuando `icon_name` no viene (backend viejo, antes de que
// el catálogo lo expusiera) o llega con un glyph que no existe en esta
// versión de @expo/vector-icons -- confirmado real contra el mapa de
// arriba, no inventado.
export const ACHIEVEMENT_ICON_FALLBACK = 'trophy-outline';

// `icon_key` nunca fue un nombre de ícono real (era la clave semántica
// del logro, ej. "streak_7") -- `icon_name` es el campo nuevo del backend
// (Gap 31, 2026-11-13) con el glyph real de MaterialCommunityIcons. Esta
// función es la única validación: el glyphMap de arriba es el que la
// librería usa de verdad, así que "válido" acá es "existe de verdad", no
// una lista propia que se puede desactualizar.
export function resolveAchievementIconName(iconName) {
  if (typeof iconName === 'string' && iconName in glyphMap) return iconName;
  return ACHIEVEMENT_ICON_FALLBACK;
}

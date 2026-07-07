import { Text, View } from 'react-native';
import { useThemeColors } from '../../theme/colors.js';

export function PaceronBrand({ size = 18, style }) {
  const colors = useThemeColors();
  const letter = { fontFamily: 'Orbitron_700Bold', fontSize: size };

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', transform: [{ skewX: '-15deg' }] }, style]}>
      <Text style={[letter, { color: colors.onBackground }]}>p</Text>
      <Text style={[letter, { color: '#8cc63e' }]}>a</Text>
      <Text style={[letter, { color: colors.onBackground }]}>ceron</Text>
    </View>
  );
}

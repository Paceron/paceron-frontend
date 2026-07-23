import { Text, View } from 'react-native';
import { useThemeColors } from '../../theme/colors.js';

export function PaceronBrand({ size = 18, style }) {
  const colors = useThemeColors();
  const letter = { fontFamily: 'Orbitron_700Bold', fontSize: size };

  return (
    <View nativeID="paceron-brand" style={[{ flexDirection: 'row', alignItems: 'center', transform: [{ skewX: '-15deg' }] }, style]} testID="paceron-brand">
      <Text nativeID="paceron-brand-letter-p" style={[letter, { color: colors.onBackground }]} testID="paceron-brand-letter-p">p</Text>
      <Text nativeID="paceron-brand-letter-a" style={[letter, { color: colors.primary }]} testID="paceron-brand-letter-a">a</Text>
      <Text nativeID="paceron-brand-letter-ceron" style={[letter, { color: colors.onBackground }]} testID="paceron-brand-letter-ceron">ceron</Text>
    </View>
  );
}

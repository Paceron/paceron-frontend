import { useThemeMode } from '../providers/theme-provider.jsx';

export const lightColors = {
  background: '#ffffff',
  onBackground: '#111518',
  surface: '#ffffff',
  onSurface: '#111518',
  onSurfaceVariant: '#40484c',
  outlineVariant: '#c0c8cd',
  surfaceContainerHigh: '#f0f0f0',
  primary: '#8cc63e',
  onPrimary: '#111518',
  primaryContainer: '#8cc63e',
  error: '#ba1a1a',
};

export const darkColors = {
  background: '#111518',
  onBackground: '#ffffff',
  surface: '#111518',
  onSurface: '#ffffff',
  onSurfaceVariant: '#c0c8cd',
  outlineVariant: '#40484c',
  surfaceContainerHigh: '#282d31',
  primary: '#8cc63e',
  onPrimary: '#111518',
  primaryContainer: '#075318',
  error: '#ffb4ab',
};

export function useThemeColors() {
  const { colorScheme } = useThemeMode();

  return colorScheme === 'dark' ? darkColors : lightColors;
}

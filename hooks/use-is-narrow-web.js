import { useWindowDimensions } from 'react-native';

// Breakpoint único para todo el shell/landing responsive de web — no
// confundir con los prefijos sm:/md:/lg: de NativeWind (esos son CSS,
// sin equivalente en nativo; acá se decide en JS qué estructura montar,
// no solo qué clase aplicar). Ver
// docs/superpowers/specs/2026-07-23-responsive-web-shell-design.md.
const NARROW_WEB_BREAKPOINT = 1024;

export function useIsNarrowWeb() {
  const { width } = useWindowDimensions();
  return width < NARROW_WEB_BREAKPOINT;
}

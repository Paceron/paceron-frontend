import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { isWeb } from '../../utils/platform.js';

// Envuelve un panel para animar apertura/cierre (fade + slide sutil) con un
// backdrop de pantalla completa que cierra al tocar afuera. Se mantiene
// siempre montado (mismo patrón que el drawer mobile) para que la
// animación de salida se vea; cuando está cerrado, pointerEvents 'none'
// evita que intercepte clicks. anchorStyle posiciona el panel (left/top o
// right/top, normalmente calculado con measureInWindow del disparador).
//
// Compartido entre components/shell (dropdown de usuario, menú de
// equipos) y cualquier otro dropdown anclado a un botón — ver
// components/team/team-detail-screen.jsx (menú de un corredor) como
// segundo consumidor. Vive fuera de components/shell porque ya no es
// exclusivo del shell de la app.
export function AnimatedDropdown({ open, onClose, anchorStyle, children }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-8);
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    const config = { duration: open ? 160 : 120, easing: Easing.out(Easing.cubic) };
    opacity.value = withTiming(open ? 1 : 0, config);
    translateY.value = withTiming(open ? 0 : -8, config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !isWeb) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!isWeb) return undefined;
    if (!open) {
      const previous = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previous?.isConnected) previous.focus?.();
      return undefined;
    }
    previousFocusRef.current = document.activeElement;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const focusable = panel?.querySelector?.(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View className="absolute inset-0 z-50" nativeID="animated-dropdown" style={{ pointerEvents: open ? 'auto' : 'none' }} testID="animated-dropdown">
      <Pressable className="absolute inset-0" nativeID="animated-dropdown-backdrop" onPress={onClose} testID="animated-dropdown-backdrop" />
      <Animated.View nativeID="animated-dropdown-panel" style={[{ position: 'absolute' }, anchorStyle, animatedStyle]} testID="animated-dropdown-panel">
        <View nativeID="animated-dropdown-panel-content" ref={panelRef} testID="animated-dropdown-panel-content">
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

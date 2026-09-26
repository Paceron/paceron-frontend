import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { clearLog, getLogLines } from '../../utils/debug-log.js';

// Panel dev-only para leer el buffer de debug-log.js en dispositivo. Toggle
// desde un boton flotante en la pantalla activa (__DEV__ solamente, sin
// coste en release).

export function DebugLogPanel() {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setVersion((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [visible]);

  return (
    <>
      <Pressable
        className="absolute right-3 top-3 z-30 h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white/80 active:opacity-70 dark:border-slate-600 dark:bg-slate-800/80"
        nativeID="debug-log-panel-toggle"
        onPress={() => {
          setVisible(true);
        }}
        testID="debug-log-panel-toggle"
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="bug-outline" size={16} />
      </Pressable>
      <Modal animationType="fade" nativeID="debug-log-panel" onRequestClose={() => setVisible(false)} testID="debug-log-panel" transparent visible={visible}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-3" nativeID="debug-log-panel-backdrop" onPress={() => setVisible(false)} testID="debug-log-panel-backdrop">
          <Pressable className="max-h-[85%] w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="debug-log-panel-card" onPress={() => {}} testID="debug-log-panel-card">
            <View className="mb-2 flex-row items-center justify-between" nativeID="debug-log-panel-header" testID="debug-log-panel-header">
              <Text className="text-base font-bold text-slate-900 dark:text-white" nativeID="debug-log-panel-title" testID="debug-log-panel-title">Log de sesión</Text>
              <View className="flex-row gap-2" nativeID="debug-log-panel-actions" testID="debug-log-panel-actions">
                <Pressable className="h-8 items-center justify-center rounded-full border border-slate-200 px-3 active:opacity-70 dark:border-slate-700" nativeID="debug-log-panel-clear" onPress={clearLog} testID="debug-log-panel-clear">
                  <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID="debug-log-panel-clear-label" testID="debug-log-panel-clear-label">Limpiar</Text>
                </Pressable>
                <Pressable className="h-8 items-center justify-center rounded-full bg-primary px-4 active:opacity-80" nativeID="debug-log-panel-close" onPress={() => setVisible(false)} testID="debug-log-panel-close">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID="debug-log-panel-close-label" testID="debug-log-panel-close-label">Cerrar</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView className="max-h-[70%] rounded-xl bg-black" contentContainerClassName="p-3" nativeID="debug-log-panel-scroll" testID="debug-log-panel-scroll">
              {getLogLines().length === 0 ? (
                <Text className="text-xs text-white/60" nativeID="debug-log-panel-empty" testID="debug-log-panel-empty">Sin registros todavía.</Text>
              ) : (
                getLogLines().map((line, index) => (
                  <Text className="text-[11px] leading-4 text-white/90" key={index} nativeID={`debug-log-panel-line-${index}`} testID={`debug-log-panel-line-${index}`}>
                    {line}
                  </Text>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
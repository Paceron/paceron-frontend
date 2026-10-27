import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

export function DashboardFiltersSheet({ visible, onClose, children, id = 'dashboard-filters-sheet' }) {
  const colors = useThemeColors();

  return (
    <Modal
      animationType="slide"
      accessibilityViewIsModal
      nativeID={`${id}-modal`}
      onRequestClose={onClose}
      statusBarTranslucent
      testID={`${id}-modal`}
      transparent
      visible={visible}
    >
      <View className="flex-1 justify-end" nativeID={`${id}-root`} style={{ backgroundColor: 'rgba(0, 0, 0, 0.48)' }} testID={`${id}-root`}>
        <Pressable
          accessibilityLabel="Cerrar filtros"
          accessibilityRole="button"
          className="absolute inset-0"
          nativeID={`${id}-backdrop`}
          onPress={onClose}
          testID={`${id}-backdrop`}
        />
        <SafeAreaView
          className="overflow-hidden rounded-t-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-surface"
          edges={['bottom']}
          nativeID={`${id}-sheet`}
          style={{ maxHeight: '92%' }}
          testID={`${id}-sheet`}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="shrink"
            nativeID={`${id}-keyboard-avoiding`}
            testID={`${id}-keyboard-avoiding`}
          >
            <View className="items-center pb-2 pt-3" nativeID={`${id}-handle-slot`} testID={`${id}-handle-slot`}>
              <View className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" nativeID={`${id}-handle`} testID={`${id}-handle`} />
            </View>
            <View className="flex-row items-center justify-between border-b border-slate-200 px-4 pb-3 dark:border-slate-700" nativeID={`${id}-header`} testID={`${id}-header`}>
              <View className="flex-row items-center gap-2" nativeID={`${id}-title-row`} testID={`${id}-title-row`}>
                <MaterialCommunityIcons color={colors.primary} name="filter-variant" size={19} />
                <Text className="text-base font-bold text-slate-900 dark:text-white" nativeID={`${id}-title`} testID={`${id}-title`}>
                  Filtros de rendimiento
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Cerrar filtros"
                accessibilityRole="button"
                className="h-11 w-11 items-center justify-center rounded-full active:bg-slate-100 dark:active:bg-slate-800"
                hitSlop={4}
                nativeID={`${id}-close`}
                onPress={onClose}
                testID={`${id}-close`}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={20} />
              </Pressable>
            </View>
            <ScrollView
              className="shrink"
              contentContainerClassName="px-4 pb-5 pt-4"
              keyboardShouldPersistTaps="handled"
              nativeID={`${id}-scroll`}
              showsVerticalScrollIndicator
              testID={`${id}-scroll`}
            >
              {children}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { SearchablePickerField } from '../forms/searchable-picker-field.jsx';
import { colorForUserId } from '../../utils/participant-color.js';
import { ParticipantAvatar } from './participant-avatar.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';

// Feed de registros (completado/salteado por serie), filtrable por corredor
// -- compartido entre la pantalla en vivo del entrenador
// (trainer-session-live-screen.jsx) y el resumen post-sesión
// (trainer-session-review-screen.jsx). El dato (`feed`) viene armado por el
// caller (en vivo vía WS + bootstrap, post-sesión vía
// use-trainer-session-summary.js) -- este componente es puramente de
// presentación + filtro.
export function RecordsFeedModal({ visible, onClose, feed, feedOptions, feedFilterAthleteId, onChangeFeedFilter, idPrefix = 'records-feed-modal' }) {
  const colors = useThemeColors();

  return (
    <Modal animationType="fade" nativeID={`${idPrefix}`} onRequestClose={onClose} testID={`${idPrefix}`} transparent visible={visible}>
      <Pressable className={`flex-1 bg-black/50 ${isWeb ? 'items-center justify-center px-4' : 'items-end'}`} nativeID={`${idPrefix}-backdrop`} onPress={onClose} testID={`${idPrefix}-backdrop`}>
        <Pressable className={isWeb ? 'max-h-[85%] w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface' : 'h-full w-full max-w-lg bg-white dark:bg-surface'} nativeID={`${idPrefix}-card`} onPress={() => {}} testID={`${idPrefix}-card`}>
          <SafeAreaView className={isWeb ? 'flex-1 gap-2' : 'flex-1 gap-2 p-4'} edges={['top', 'bottom']} nativeID={`${idPrefix}-card-safe-area`} testID={`${idPrefix}-card-safe-area`}>
            <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>Registros</Text>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" nativeID={`${idPrefix}-close-button`} onPress={onClose} testID={`${idPrefix}-close-button`}>
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
              </Pressable>
            </View>
            <View className="flex-row items-end gap-2" nativeID={`${idPrefix}-filter-row`} testID={`${idPrefix}-filter-row`}>
              <SearchablePickerField
                className="mb-0 flex-1"
                dense
                idPrefix={`${idPrefix}-filter`}
                label="Filtrar por corredor"
                onChange={onChangeFeedFilter}
                options={feedOptions}
                placeholder="Todos"
                value={feedFilterAthleteId}
              />
              {feedFilterAthleteId != null && (
                <IconTooltip idPrefix={`${idPrefix}-filter-clear-tooltip`} label="Quitar filtro">
                  <Pressable
                    accessibilityLabel="Quitar filtro"
                    className="h-12 w-12 items-center justify-center rounded-xl border border-slate-200 active:opacity-70 dark:border-slate-700"
                    nativeID={`${idPrefix}-filter-clear`}
                    onPress={() => onChangeFeedFilter(null)}
                    testID={`${idPrefix}-filter-clear`}
                  >
                    <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={20} />
                  </Pressable>
                </IconTooltip>
              )}
            </View>
            <ScrollView className="flex-1" nativeID={`${idPrefix}-list`} testID={`${idPrefix}-list`}>
              {feed.map((event) => (
                <View className="flex-row items-center gap-2.5 border-b border-slate-100 p-3 dark:border-slate-800" key={event.id} nativeID={`${idPrefix}-item-${event.id}`} testID={`${idPrefix}-item-${event.id}`}>
                  <ParticipantAvatar color={colorForUserId(event.athleteUserId)} idPrefix={`${idPrefix}-item-${event.id}`} name={event.athleteName} photoUrl={event.athletePhotoUrl} size={32} />
                  <Text className="flex-1 text-sm text-slate-900 dark:text-white" nativeID={`${idPrefix}-item-${event.id}-text`} testID={`${idPrefix}-item-${event.id}-text`}>
                    {event.athleteName} · {event.exerciseName} · Serie {event.setNumber} · {event.status === 'skipped' ? 'Salteada' : 'Completada'}
                  </Text>
                </View>
              ))}
              {feed.length === 0 && (
                <Text className="p-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-empty`} testID={`${idPrefix}-empty`}>
                  Sin registros todavía.
                </Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

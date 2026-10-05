import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TRAINER_MARKER_COLOR } from '../../utils/participant-color.js';
import { ParticipantAvatar } from './participant-avatar.jsx';

// El entrenador participa de la sesión (se une con su propio Play, Gap 26)
// pero NO es un corredor más -- no tiene series/ejercicios, ningún badge de
// estado de corredor (completado/interrumpido/etc.) le corresponde. Esta card
// lo muestra separado del listado de participantes, con el mismo color ámbar
// que ya lo identifica en el mapa (TRAINER_MARKER_COLOR) en vez del color por
// hash de colorForUserId que usan los corredores -- usada en el pre-start, la
// lista de participantes en vivo y el resumen post-sesión del entrenador.
export function TrainerCard({ name, photoUrl, idPrefix }) {
  return (
    <View className="flex-row items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-700 dark:bg-amber-900/20" nativeID={idPrefix} testID={idPrefix}>
      <ParticipantAvatar color={TRAINER_MARKER_COLOR} idPrefix={idPrefix} name={name} photoUrl={photoUrl} size={36} />
      <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
        {name}
      </Text>
      <View className="flex-row items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1" nativeID={`${idPrefix}-badge`} testID={`${idPrefix}-badge`}>
        <MaterialCommunityIcons color="#78350f" name="whistle-outline" size={12} />
        <Text className="text-[11px] font-semibold text-amber-950" nativeID={`${idPrefix}-badge-label`} testID={`${idPrefix}-badge-label`}>Entrenador</Text>
      </View>
    </View>
  );
}

import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useSpeechDictation } from '../../hooks/use-speech-dictation.js';
import { speak, stopSpeaking } from '../../utils/speech.js';

// Botonera de voz del campo de anotaciones: micrófono (dictado, voz → texto) y
// altavoz (leer en voz alta, texto → voz). Los dos sentidos que pidió el
// usuario, con un solo campo de texto.
//
// El dictado ENTREGA el texto al terminar (onText), no en vivo: se acumula el
// resultado final y se emite una sola vez al hacer stop(), porque los
// resultados parciales de iOS se reemplazan por los finales y el texto
// parpadearía/dupicaría. Lo que se ve mientras se habla es el interim, que va
// en un renglón aparte debajo del campo.
export function VoiceAnnotationControls({ text, onAppendText }) {
  const colors = useThemeColors();
  const [speaking, setSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState(null);

  const dictation = useSpeechDictation({
    // Dictar AGREGA a lo que ya había: nunca pisa una nota escrita a mano.
    onText: (transcribed) => {
      const base = String(text ?? '').trim();
      onAppendText(base ? `${base} ${transcribed}` : transcribed);
    },
  });

  const handleToggleDictation = () => {
    if (dictation.listening) {
      dictation.stop();
    } else {
      setTtsError(null);
      dictation.clearError();
      dictation.start();
    }
  };

  // available === null → todavía no se probed, no deshabilitar por eso.
  const dictationEnabled = dictation.available !== false;

  const handleToggleSpeak = async () => {
    setTtsError(null);
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const clean = String(text ?? '').trim();
    if (!clean) return;
    setSpeaking(true);
    try {
      await speak(clean);
    } catch {
      setTtsError('No pudimos leer la anotación en voz alta.');
    } finally {
      setSpeaking(false);
    }
  };

  const hasText = Boolean(String(text ?? '').trim());

  return (
    <View nativeID="session-review-voice-controls" testID="session-review-voice-controls">
      <View className="flex-row items-center gap-2" nativeID="session-review-voice-controls-row" testID="session-review-voice-controls-row">
        <Pressable
          className={`h-8 w-8 items-center justify-center rounded-full active:opacity-70 ${dictation.listening ? 'bg-red-500' : 'bg-slate-100 dark:bg-slate-800'} ${dictationEnabled ? '' : 'opacity-40'}`}
          disabled={!dictationEnabled}
          hitSlop={6}
          nativeID="session-review-voice-dictate-button"
          onPress={handleToggleDictation}
          testID="session-review-voice-dictate-button"
        >
          <MaterialCommunityIcons
            color={dictation.listening ? '#ffffff' : colors.onSurfaceVariant}
            name={dictation.listening ? 'microphone' : 'microphone-outline'}
            size={16}
          />
        </Pressable>

        <Pressable
          className={`h-8 w-8 items-center justify-center rounded-full active:opacity-70 ${speaking ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800'} ${hasText ? '' : 'opacity-40'}`}
          disabled={!hasText && !speaking}
          hitSlop={6}
          nativeID="session-review-voice-speak-button"
          onPress={handleToggleSpeak}
          testID="session-review-voice-speak-button"
        >
          {speaking ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="volume-high" size={16} />
          )}
        </Pressable>

        <Text className="flex-1 text-[10px] text-slate-400 dark:text-slate-500" nativeID="session-review-voice-controls-hint" testID="session-review-voice-controls-hint">
          {dictation.listening ? dictation.interim ? `“${dictation.interim}”` : 'Escuchando…' : 'Dictá con el micrófono o escuchá la nota.'}
        </Text>
      </View>

      {(dictation.error || ttsError) && (
        <Text className="mt-1 text-[10px] text-amber-600 dark:text-amber-400" nativeID="session-review-voice-controls-error" testID="session-review-voice-controls-error">
          {dictation.error || ttsError}
        </Text>
      )}

      {dictation.available === false && (
        <Text className="mt-1 text-[10px] text-amber-600 dark:text-amber-400" nativeID="session-review-voice-controls-unavailable" testID="session-review-voice-controls-unavailable">
          El dictado no está disponible — falta recompilar la app (dev client) con el módulo de voz.
        </Text>
      )}
    </View>
  );
}

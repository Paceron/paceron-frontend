import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  SpeechRecognizerErrorAndroid,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// Dictado por voz (voz → texto) para las anotaciones de una serie. Envuelve
// expo-speech-recognition, que habla con SFSpeechRecognizer (iOS),
// SpeechRecognizer (Android) y Web SpeechRecognition (web) con la misma API.
//
// Diferencia con el TTS (utils/speech.js): esto NO escribe texto, lo TRANSCRIBE
// — el texto devuelto se mete en el campo de anotaciones. Para leer en voz alta
// lo que ya está escrito, usar speak()/stopSpeaking() de utils/speech.js.
//
// Note: en web la Web Speech API del navegador manda el audio al proveedor del
// navegador (Chrome/Google, Safari/Apple) — es el mismo comportamiento de
// cualquier dictated-input web, no es un server nuestro.

// Errores que no son culpa del usuario: no deserve un toast, solo cortamos.
const SILENT_ERROR_CODES = new Set(['no-speech', 'aborted', 'canceled']);

function messageForError(code) {
  if (code === 'not-allowed' || code === 'permission-denied') return 'Necesitamos permiso de micrófono para dictar.';
  if (code === 'no-speech') return 'No escuchamos nada.';
  if (code === 'network') return 'Sin conexión para transcribir el audio.';
  if (code === 'service-not-available') return 'El servicio de voz no está disponible en este dispositivo.';
  if (code === 'language-not-supported') return 'El idioma configurado no está soportado.';
  if (code === 'audio-capture') return 'No encontramos un micrófono disponible.';
  return 'No pudimos transcribir el audio.';
}

// Cada cuánto cerramos el dictado tras la última palabra. La librería no
// expone silenceDurationMillis en la API JS (es un extra nativo de Android que
// el recognizer aplica por su cuenta y varía por dispositivo), así que el corte
// por silencio se maneja ACÁ: es el mismo número en las tres plataformas y el
// usuario puede cortarlo antes tocando el micro otra vez.
const SILENCE_STOP_MS = 3000;

export function useSpeechDictation({ onText, language = 'es-ES', silenceStopMs = SILENCE_STOP_MS } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const [available, setAvailable] = useState(null); // null = aún no se consultó

  // El texto ya confirmado se acumula acá y se entrega al PARAR, no durante: si
  // emitimos partials en vivo, los resultados finales de iOS reemplazan al
  // interim y el usuario vería el texto duplicarse/parpadear.
  const finalTextRef = useRef('');
  // Espejo del interim en un ref para que el handler de 'end' (que no depende
  // del render) pueda usarlo como fallback.
  const interimRef = useRef('');
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  // Timer de corte por silencio, alimentado por cada 'result'. Se reinicia en
  // cada palabra y, si pasan `silenceStopMs` sin nada nuevo, cerramos nosotros.
  const silenceTimerRef = useRef(null);
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);
  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // si el recognizer ya se cerró solo, el 'end' de abajo igual corre
      }
    }, silenceStopMs);
  }, [clearSilenceTimer, silenceStopMs]);

  // Al desmontar hay que cortar el timer: si no, dispara contra un componente
  // que ya no existe (y en dev con StrictMode queda el timer colgado).
  useEffect(() => clearSilenceTimer, [clearSilenceTimer]);

  // Probe de disponibilidad: si el módulo nativo no está linkeado (dev client
  // sin rebuildear tras agregar la dependencia) la llamada tira, y conviene
  // avisarlo en la UI en vez de fallar en silencio al apretar el micrófono.
  // OJO: getPermissionsAsync NO depende del permiso concedido — responde
  // incluso sin permiso, que es justamente cuando queremos empezar a
  // dictar (el permiso se pide en start()).
  useEffect(() => {
    let cancelled = false;
    ExpoSpeechRecognitionModule.getPermissionsAsync()
      .then(() => {
        if (!cancelled) setAvailable(true);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // `isFinal` viene en el EVENTO, no en cada resultado (el resultado solo
  // trae transcript/confidence/segments). Chequear last.isFinal — como estaba
  // antes — daba undefined siempre, así que la rama final nunca corría, el
  // finalTextRef quedaba vacío y al cortar no se emitía nada: el interim se
  // veía abajo pero la caja de texto quedaba vacía.
  useSpeechRecognitionEvent('result', (event) => {
    const results = event?.results ?? [];
    if (results.length === 0) return;
    const last = results[results.length - 1];
    if (event?.isFinal) {
      finalTextRef.current = `${finalTextRef.current} ${last.transcript ?? ''}`.trim();
      setInterim('');
      interimRef.current = '';
    } else {
      setInterim(last?.transcript ?? '');
      interimRef.current = last?.transcript ?? '';
    }
    // Cada palabra (final o parcial) patea el corte por silencio.
    armSilenceTimer();
  });

  useSpeechRecognitionEvent('error', (event) => {
    const code = event?.error ?? event?.errorCode;
    // Android entrega objetos de error con nombre; iOS strings.
    const raw = typeof code === 'string' ? code : code?.message ?? 'unknown';
    clearSilenceTimer();
    setListening(false);
    setInterim('');
    if (SILENT_ERROR_CODES.has(raw)) return;
    setError(messageForError(raw));
  });

  useSpeechRecognitionEvent('end', () => {
    clearSilenceTimer();
    setListening(false);
    setInterim('');
    // Fallback: si cortamos a mano y el recognizer no llegó a emitir un
    // resultado final, el interim es lo único que tenemos — mejor eso que
    // perder lo que el usuario dijo.
    const text = (finalTextRef.current || interimRef.current).trim();
    finalTextRef.current = '';
    interimRef.current = '';
    if (text) onTextRef.current?.(text);
  });

  const start = useCallback(async () => {
    setError(null);
    finalTextRef.current = '';
    interimRef.current = '';
    setInterim('');
    try {
      const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (perms?.granted === false) {
        setError('Necesitamos permiso de micrófono para dictar.');
        return;
      }
    } catch (e) {
      setError('No pudimos pedir el permiso de micrófono.');
      return;
    }
    setListening(true);
    try {
      ExpoSpeechRecognitionModule.start({
        lang: language,
        interimResults: true,
        continuous: false,
        // El usuario mete puntuación y comas habladas ("coma", "punto").
        addsPunctuation: Platform.OS === 'ios' ? true : undefined,
      });
    } catch (e) {
      setListening(false);
      setError('No pudimos iniciar el dictado.');
    }
  }, [language, clearSilenceTimer]);

  const stop = useCallback(() => {
    // El timer se limpia acá y de nuevo en 'end' (idempotente): stop() puede
    // no disparar 'end' si no había sesión corriendo.
    clearSilenceTimer();
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // si no había nada corriendo, el estado ya quedó consistente
    }
  }, [clearSilenceTimer]);

  const cancel = useCallback(() => {
    clearSilenceTimer();
    finalTextRef.current = '';
    interimRef.current = '';
    setInterim('');
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // idem
    }
    setListening(false);
  }, [clearSilenceTimer]);

  return { available, error, interim, listening, start, stop, cancel, clearError: () => setError(null) };
}

export { SpeechRecognizerErrorAndroid };

import * as Speech from 'expo-speech';

// Texto → voz para LEER en voz alta las anotaciones de una serie (accesibilidad
// y revisar la nota sin mirar la pantalla). Es el camino inverso al dictado de
// hooks/use-speech-dictation.js: acá la anotación ya está escrita y lo que se
// genera es audio.
//
// expo-speech es oficial de Expo y habla con las voces del sistema en iOS y
// Android, y con la Web Speech API en web — un solo código para las tres
// plataformas. No requiere API key ni backend.
//
// Puter.js (puter.ai.txt2speech) quedó descartado para esto: es un SDK de
// navegador (se carga por <script>, devuelve un HTMLAudioElement y su auth abre
// un popup), así que no corre en el build nativo de Expo.

let speakingHandle = null;

// speak() es envuelto en promesa porque expo-speech no la trae: se resuelve al
// terminar (o al cortar con stopSpeaking). Sin esto el caller no puede saber
// cuándo volver a habilitar el botón.
export function speak(text, { language = 'es-ES', pitch = 1.0, rate = 1.0, onDone } = {}) {
  const clean = String(text ?? '').trim();
  if (!clean) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      speakingHandle = null;
      onDone?.();
      resolve();
    };

    try {
      speakingHandle = Speech.speak(clean, {
        language,
        pitch,
        rate,
        onDone: finish,
        onStopped: finish,
        onError: finish,
      });
    } catch {
      finish();
    }
  });
}

// Corta la lectura en curso. Es idempotente: si no hay nada sonando, no hace
// nada (el botón de volver a tocar no debe romper).
export function stopSpeaking() {
  try {
    Speech.stop();
  } catch {
    // sin lectura en curso
  }
  speakingHandle = null;
}

export function isSpeaking() {
  return speakingHandle != null;
}

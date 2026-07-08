import { Platform } from 'react-native';

// Adaptador de storage con resolución determinística por plataforma (un solo
// archivo, sin variante .web para evitar problemas de resolución de Metro):
// web usa localStorage, native usa expo-secure-store.

function createWebStorage() {
  return {
    getItem: async (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: async (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // storage no disponible (modo privado) — se ignora
      }
    },
    removeItem: async (key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

function createNativeStorage() {
  // require dentro del branch: expo-secure-store nunca se carga en web.
  const SecureStore = require('expo-secure-store');
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  };
}

const storage = Platform.OS === 'web' ? createWebStorage() : createNativeStorage();

export const getItem = storage.getItem;
export const setItem = storage.setItem;
export const removeItem = storage.removeItem;

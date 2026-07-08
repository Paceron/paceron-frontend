import * as SecureStore from 'expo-secure-store';

export async function getItem(key) {
  return await SecureStore.getItemAsync(key);
}

export async function setItem(key, value) {
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key) {
  await SecureStore.deleteItemAsync(key);
}

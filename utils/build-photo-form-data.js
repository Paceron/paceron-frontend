import { isWeb } from './platform.js';

// Arma el FormData para subir una foto — split real por plataforma, no
// cosmético. Nativo: el polyfill de fetch/FormData de React Native acepta
// el objeto {uri, name, type} directo. Web (react-native-web en un
// browser real): un browser no acepta ese shape en FormData.append — hace
// falta el Blob real primero (fetch(uri).then(r => r.blob())). Ver
// docs/superpowers/specs/2026-09-03-profile-team-photo-upload-design.md.
export async function buildPhotoFormData(uri, { mimeType = 'image/jpeg', fieldName = 'photo' } = {}) {
  const formData = new FormData();
  if (isWeb) {
    const blob = await fetch(uri).then((r) => r.blob());
    formData.append(fieldName, blob, 'photo.jpg');
  } else {
    formData.append(fieldName, { uri, name: 'photo.jpg', type: mimeType });
  }
  return formData;
}

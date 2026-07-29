import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useAddressCascade } from './use-address-cascade.js';

// Estado + validación + selector de foto de los "datos generales" de un
// equipo (nombre, foto, ubicación, descripción, nivel, cupo, requisitos) —
// compartido por CreateTeamScreen (paso 1 del wizard) y EditTeamScreen
// (pantalla única, sin grupos ni invitaciones). `initial` precarga los
// campos (vacío al crear, el equipo real al editar); `maxAllowed` es el
// tope de integrantes del plan del entrenador.
export function useTeamGeneralInfoForm({ initial, maxAllowed }) {
  const [name, setName] = useState(initial?.name ?? '');
  const {
    country,
    province,
    city,
    provinceOptions,
    cityOptions,
    countryOptions,
    handleCountryChange,
    handleProvinceChange,
    handleCityChange,
  } = useAddressCascade({ country: initial?.country, province: initial?.province, city: initial?.city });
  const [description, setDescription] = useState(initial?.description ?? '');
  const [level, setLevel] = useState(initial?.level ?? '');
  const [maxMembers, setMaxMembers] = useState(initial?.maxMembers != null ? String(initial.maxMembers) : '');
  const [requirements, setRequirements] = useState(initial?.requirements ?? '');
  const [photoUri, setPhotoUri] = useState(initial?.photoUri ?? null);
  const [errors, setErrors] = useState({});

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'Permiso necesario', text2: 'Habilitá el acceso a tus fotos para elegir una imagen.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Ingresá un nombre para el equipo.';
    if (!level) next.level = 'Elegí un nivel.';

    const parsedMax = Number(maxMembers);
    if (!maxMembers.trim() || !Number.isInteger(parsedMax) || parsedMax < 1) {
      next.maxMembers = 'Ingresá una cantidad válida.';
    } else if (parsedMax > maxAllowed) {
      next.maxMembers = `Tu plan permite hasta ${maxAllowed} integrantes.`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const getValues = () => ({
    name: name.trim(),
    country,
    province,
    city,
    description: description.trim(),
    level,
    maxMembers: Number(maxMembers),
    requirements: requirements.trim(),
    photoUri,
  });

  return {
    name,
    setName,
    country,
    province,
    city,
    provinceOptions,
    cityOptions,
    countryOptions,
    handleCountryChange,
    handleProvinceChange,
    handleCityChange,
    description,
    setDescription,
    level,
    setLevel,
    maxMembers,
    setMaxMembers,
    requirements,
    setRequirements,
    photoUri,
    handlePickPhoto,
    errors,
    validate,
    getValues,
  };
}

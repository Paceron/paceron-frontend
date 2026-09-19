import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import { reverseGeocode, searchAddress } from '../services/geocoding.js';
import { notifyError } from '../utils/haptics.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

export function useLocationPicker({ value, onChange }) {
  const [visible, setVisible] = useState(false);
  const [pin, setPin] = useState(null);
  const [label, setLabel] = useState('');
  const [resolving, setResolving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const selectPoint = useCallback(async (lat, lng) => {
    setPin({ lat, lng });
    setError(null);
    setResolving(true);
    try {
      const address = await reverseGeocode(lat, lng);
      setLabel(address ?? '');
    } catch {
      setError('No pudimos resolver la dirección, podés escribirla a mano.');
    } finally {
      setResolving(false);
    }
  }, []);

  // silent=true (auto-locate al abrir sin ubicación previa) no debe
  // mostrar errores de permiso/GPS — el usuario no pidió nada explícito
  // todavía, se queda en el centro default sin nagging.
  const locate = useCallback(async ({ silent } = {}) => {
    const fail = (message) => {
      if (silent) return;
      setError(message);
      notifyError();
      Toast.show({ type: 'error', text1: message });
    };
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        fail('Necesitamos permiso de ubicación para esto.');
        return;
      }
      let position;
      try {
        // BestForNavigation fuerza GPS real en mobile en vez de conformarse
        // con WiFi/celda — en desktop (sin GPS) no cambia nada, la precisión
        // ahí depende del backend de ubicación del SO (GeoClue2 en Linux,
        // WiFi-based, notoriamente menos preciso que Windows/macOS).
        position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      } catch {
        // getCurrentPositionAsync pide un fix en vivo — en emuladores sin
        // Google Play Services o sin GPS simulado puede fallar aunque el
        // permiso esté OK. getLastKnownPositionAsync devuelve la última
        // posición cacheada, más tolerante en ese escenario.
        position = await Location.getLastKnownPositionAsync();
      }
      if (!position) {
        fail('No pudimos obtener tu ubicación actual.');
        return;
      }
      await selectPoint(position.coords.latitude, position.coords.longitude);
    } catch {
      fail('No pudimos obtener tu ubicación actual.');
    }
  }, [selectPoint]);

  const useMyLocation = useCallback(() => locate({ silent: false }), [locate]);

  const open = useCallback(() => {
    const hasValue = Boolean(value);
    setPin(hasValue ? { lat: value.lat, lng: value.lng } : null);
    setLabel(value?.label ?? '');
    setSearchQuery('');
    setError(null);
    setVisible(true);
    // Sin ubicación previa (alta nueva, no edición) — centrar directo en
    // el GPS del usuario si hay permiso, en vez de arrancar siempre en
    // Buenos Aires.
    if (!hasValue) locate({ silent: true });
  }, [value, locate]);

  const close = useCallback(() => setVisible(false), []);

  const runSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const result = await searchAddress(searchQuery.trim());
      if (!result) {
        setError('No encontramos esa dirección.');
        return;
      }
      await selectPoint(result.lat, result.lng);
    } catch {
      setError('No pudimos buscar esa dirección.');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, selectPoint]);

  const confirm = useCallback(() => {
    if (!pin) return;
    onChange({ lat: pin.lat, lng: pin.lng, label: label.trim() || null });
    setVisible(false);
  }, [pin, label, onChange]);

  return {
    visible, open, close,
    pin, selectPoint,
    label, setLabel,
    resolving,
    searchQuery, setSearchQuery, searching, runSearch,
    error,
    useMyLocation,
    confirm,
    defaultCenter: DEFAULT_CENTER,
  };
}

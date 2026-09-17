import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { reverseGeocode, searchAddress } from '../services/geocoding.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

export function useLocationPicker({ value, onChange }) {
  const [visible, setVisible] = useState(false);
  const [pin, setPin] = useState(null);
  const [label, setLabel] = useState('');
  const [resolving, setResolving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const open = useCallback(() => {
    setPin(value ? { lat: value.lat, lng: value.lng } : null);
    setLabel(value?.label ?? '');
    setSearchQuery('');
    setError(null);
    setVisible(true);
  }, [value]);

  const close = useCallback(() => setVisible(false), []);

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

  const useMyLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Necesitamos permiso de ubicación para esto.');
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    await selectPoint(position.coords.latitude, position.coords.longitude);
  }, [selectPoint]);

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

import { useEffect, useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { OPENFREEMAP_STYLE_URL } from '../../config/maps.js';
import { useLocationPicker } from '../../hooks/use-location-picker.js';

function MiniMap({ lat, lng }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: [lng, lat],
      zoom: 14,
      interactive: false,
      attributionControl: false,
    });
    new maplibregl.Marker({ color: '#8cc63e' }).setLngLat([lng, lat]).addTo(map);
    return () => map.remove();
  }, [lat, lng]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

export function LocationPicker({ value, onChange }) {
  const colors = useThemeColors();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const picker = useLocationPicker({ value, onChange });

  useEffect(() => {
    if (!picker.visible || mapRef.current) return;
    const initialCenter = value ? [value.lng, value.lat] : [picker.defaultCenter.lng, picker.defaultCenter.lat];
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: initialCenter,
      zoom: value ? 15 : 12,
    });
    map.on('click', (e) => picker.selectPoint(e.lngLat.lat, e.lngLat.lng));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker.visible]);

  useEffect(() => {
    if (!mapRef.current || !picker.pin) return;
    const map = mapRef.current;
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: '#ef4444' }).setLngLat([picker.pin.lng, picker.pin.lat]).addTo(map);
    } else {
      markerRef.current.setLngLat([picker.pin.lng, picker.pin.lat]);
    }
    map.flyTo({ center: [picker.pin.lng, picker.pin.lat] });
  }, [picker.pin]);

  return (
    <>
      {value ? (
        <Pressable
          className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          nativeID="location-picker-preview"
          onPress={picker.open}
          testID="location-picker-preview"
        >
          <View className="h-16 w-16 overflow-hidden rounded-lg" nativeID="location-picker-preview-map" testID="location-picker-preview-map">
            <MiniMap lat={value.lat} lng={value.lng} />
          </View>
          <View className="flex-1" nativeID="location-picker-preview-info" testID="location-picker-preview-info">
            <Text
              className="text-sm text-slate-900 dark:text-white"
              nativeID="location-picker-preview-label"
              numberOfLines={2}
              testID="location-picker-preview-label"
            >
              {value.label || `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}
            </Text>
            <Text className="text-xs font-semibold text-primary" nativeID="location-picker-preview-change" testID="location-picker-preview-change">
              Cambiar
            </Text>
          </View>
        </Pressable>
      ) : (
        <Pressable
          className="h-12 flex-row items-center justify-center gap-2 rounded-full border border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          nativeID="location-picker-open-button"
          onPress={picker.open}
          testID="location-picker-open-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-outline" size={18} />
          <Text
            className="text-sm font-semibold text-slate-700 dark:text-slate-200"
            nativeID="location-picker-open-button-label"
            testID="location-picker-open-button-label"
          >
            Elegir ubicación
          </Text>
        </Pressable>
      )}

      <Modal animationType="fade" nativeID="location-picker-modal" onRequestClose={picker.close} testID="location-picker-modal" transparent visible={picker.visible}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 px-4"
          nativeID="location-picker-modal-backdrop"
          onPress={picker.close}
          testID="location-picker-modal-backdrop"
        >
          <Pressable
            className="w-full max-w-2xl gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
            nativeID="location-picker-modal-card"
            onPress={() => {}}
            testID="location-picker-modal-card"
          >
            <View className="flex-row items-center gap-2" nativeID="location-picker-modal-header" testID="location-picker-modal-header">
              <TextInput
                className="h-10 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                nativeID="location-picker-search-input"
                onChangeText={picker.setSearchQuery}
                onSubmitEditing={picker.runSearch}
                placeholder="Buscar dirección"
                placeholderTextColor={colors.onSurfaceVariant}
                returnKeyType="search"
                testID="location-picker-search-input"
                value={picker.searchQuery}
              />
              <Pressable disabled={picker.searching} nativeID="location-picker-search-button" onPress={picker.runSearch} testID="location-picker-search-button">
                {picker.searching
                  ? <ActivityIndicator color={colors.primary} size="small" />
                  : <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={22} />}
              </Pressable>
              <Pressable nativeID="location-picker-modal-close-button" onPress={picker.close} testID="location-picker-modal-close-button">
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
              </Pressable>
            </View>

            <View className="h-[420px] overflow-hidden rounded-xl" nativeID="location-picker-map-wrapper" testID="location-picker-map-wrapper">
              <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
              <Pressable
                className="absolute bottom-4 right-4 h-12 w-12 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
                nativeID="location-picker-my-location-button"
                onPress={picker.useMyLocation}
                testID="location-picker-my-location-button"
              >
                <MaterialCommunityIcons color={colors.primary} name="crosshairs-gps" size={22} />
              </Pressable>
            </View>

            {picker.error && (
              <Text className="text-xs text-red-500 dark:text-red-400" nativeID="location-picker-error" testID="location-picker-error">
                {picker.error}
              </Text>
            )}
            <TextInput
              className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              editable={!picker.resolving}
              nativeID="location-picker-label-input"
              onChangeText={picker.setLabel}
              placeholder={picker.resolving ? 'Resolviendo dirección...' : 'Descripción del lugar (opcional)'}
              placeholderTextColor={colors.onSurfaceVariant}
              testID="location-picker-label-input"
              value={picker.label}
            />
            <Pressable
              className={`h-12 items-center justify-center rounded-full bg-primary hover:opacity-90 ${!picker.pin ? 'opacity-40' : ''}`}
              disabled={!picker.pin}
              nativeID="location-picker-confirm-button"
              onPress={picker.confirm}
              testID="location-picker-confirm-button"
            >
              <Text
                className="text-sm font-semibold uppercase tracking-wide text-[#111518]"
                nativeID="location-picker-confirm-button-label"
                testID="location-picker-confirm-button-label"
              >
                Confirmar
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

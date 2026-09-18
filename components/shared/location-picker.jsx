import { useEffect, useRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { OPENFREEMAP_STYLE_URL } from '../../config/maps.js';
import { useLocationPicker } from '../../hooks/use-location-picker.js';

export function LocationPicker({ value, onChange }) {
  const colors = useThemeColors();
  const cameraRef = useRef(null);
  const picker = useLocationPicker({ value, onChange });

  useEffect(() => {
    if (!picker.visible || !picker.pin || !cameraRef.current) return;
    cameraRef.current.flyTo({ center: [picker.pin.lng, picker.pin.lat], duration: 400 });
  }, [picker.visible, picker.pin]);

  const handleMapPress = (event) => {
    const [lng, lat] = event.nativeEvent.lngLat;
    picker.selectPoint(lat, lng);
  };

  const initialCenter = value
    ? [value.lng, value.lat]
    : [picker.defaultCenter.lng, picker.defaultCenter.lat];

  return (
    <>
      {value ? (
        <Pressable
          className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"
          nativeID="location-picker-preview"
          onPress={picker.open}
          testID="location-picker-preview"
        >
          <View
            className="h-16 w-16 overflow-hidden rounded-lg"
            nativeID="location-picker-preview-map"
            pointerEvents="none"
            testID="location-picker-preview-map"
          >
            <Map
              attribution={false}
              compass={false}
              dragPan={false}
              doubleTapHoldZoom={false}
              doubleTapZoom={false}
              logo={false}
              mapStyle={OPENFREEMAP_STYLE_URL}
              nativeID="location-picker-preview-map-instance"
              scaleBar={false}
              style={{ flex: 1 }}
              testID="location-picker-preview-map-instance"
              touchPitch={false}
              touchRotate={false}
              touchZoom={false}
            >
              <Camera initialViewState={{ center: [value.lng, value.lat], zoom: 14 }} />
              <Marker anchor="bottom" lngLat={[value.lng, value.lat]}>
                <MaterialCommunityIcons color="#8cc63e" name="map-marker" size={22} />
              </Marker>
            </Map>
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
          className="h-12 flex-row items-center justify-center gap-2 rounded-full border border-slate-300 dark:border-slate-600"
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

      <Modal
        animationType="slide"
        nativeID="location-picker-modal"
        onRequestClose={picker.close}
        testID="location-picker-modal"
        visible={picker.visible}
      >
        <SafeAreaView className="flex-1 bg-white dark:bg-ink" edges={['top', 'bottom']} nativeID="location-picker-modal-content" testID="location-picker-modal-content">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            nativeID="location-picker-modal-keyboard-avoiding"
            style={{ flex: 1 }}
            testID="location-picker-modal-keyboard-avoiding"
          >
            <View
              className="flex-row items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-700"
              nativeID="location-picker-modal-header"
              testID="location-picker-modal-header"
            >
              <Pressable nativeID="location-picker-modal-close-button" onPress={picker.close} testID="location-picker-modal-close-button">
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
              </Pressable>
              <TextInput
                className="h-10 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
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
            </View>

            <View className="flex-1 overflow-hidden" nativeID="location-picker-map-wrapper" testID="location-picker-map-wrapper">
              <Map
                mapStyle={OPENFREEMAP_STYLE_URL}
                nativeID="location-picker-map"
                onPress={handleMapPress}
                style={{ flex: 1 }}
                testID="location-picker-map"
              >
                <Camera initialViewState={{ center: initialCenter, zoom: picker.pin ? 15 : 12 }} ref={cameraRef} />
                {picker.pin && (
                  <Marker anchor="bottom" lngLat={[picker.pin.lng, picker.pin.lat]}>
                    <MaterialCommunityIcons color="#ef4444" name="map-marker" size={32} />
                  </Marker>
                )}
              </Map>

              <Pressable
                className="absolute bottom-4 right-4 h-12 w-12 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
                nativeID="location-picker-my-location-button"
                onPress={picker.useMyLocation}
                testID="location-picker-my-location-button"
              >
                <MaterialCommunityIcons color={colors.primary} name="crosshairs-gps" size={22} />
              </Pressable>
            </View>

            <View className="gap-2 border-t border-slate-200 p-3 dark:border-slate-700" nativeID="location-picker-footer" testID="location-picker-footer">
              {picker.error && (
                <Text className="text-xs text-red-500 dark:text-red-400" nativeID="location-picker-error" testID="location-picker-error">
                  {picker.error}
                </Text>
              )}
              <TextInput
                className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                editable={!picker.resolving}
                nativeID="location-picker-label-input"
                onChangeText={picker.setLabel}
                placeholder={picker.resolving ? 'Resolviendo dirección...' : 'Descripción del lugar (opcional)'}
                placeholderTextColor={colors.onSurfaceVariant}
                testID="location-picker-label-input"
                value={picker.label}
              />
              <Pressable
                className={`h-12 items-center justify-center rounded-full bg-primary ${!picker.pin ? 'opacity-40' : ''}`}
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
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

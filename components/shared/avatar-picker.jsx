// components/shared/avatar-picker.jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Avatar circular con foto real (si hay `uri`) o ícono default —
// compartido entre foto de perfil (fallbackIcon="account") e ícono de
// equipo (fallbackIcon="account-group"). Sin `onPick`, queda de solo
// lectura: sin lápiz, sin basurero, no tocable — mismo componente sirve
// para "mi perfil" (siempre editable) y "detalle de equipo" (editable
// solo para el dueño). `onError` de la imagen cubre el 404 conocido del
// bucket de Supabase (ver docs/superpowers/specs/2026-09-03-profile-team-photo-upload-design.md)
// cayendo al ícono default en vez de mostrar un ícono roto.
export function AvatarPicker({ uri, onPick, onRemove, loading = false, size = 64, fallbackIcon, idPrefix, accessibilityLabel }) {
  const colors = useThemeColors();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  const editable = Boolean(onPick);
  const showImage = Boolean(uri) && !imageFailed;

  return (
    <View className="relative" nativeID={`${idPrefix}-wrapper`} testID={`${idPrefix}-wrapper`}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        className="items-center justify-center overflow-hidden rounded-full bg-slate-100 hover:opacity-80 active:opacity-70 dark:bg-slate-800"
        disabled={loading || !editable}
        nativeID={`${idPrefix}-button`}
        onPress={onPick}
        style={{ height: size, width: size }}
        testID={`${idPrefix}-button`}
      >
        {showImage ? (
          <Image
            accessibilityLabel={accessibilityLabel}
            className="rounded-full"
            nativeID={`${idPrefix}-image`}
            onError={() => setImageFailed(true)}
            source={{ uri }}
            style={{ height: size, width: size }}
            testID={`${idPrefix}-image`}
          />
        ) : (
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name={fallbackIcon} size={size * 0.5} />
        )}
        {loading && (
          <View className="absolute inset-0 items-center justify-center bg-black/40" nativeID={`${idPrefix}-loading`} testID={`${idPrefix}-loading`}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        )}
      </Pressable>

      {editable && !loading && (
        <View
          className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-primary dark:border-surface"
          nativeID={`${idPrefix}-edit-badge`}
          pointerEvents="none"
          testID={`${idPrefix}-edit-badge`}
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="pencil" size={11} />
        </View>
      )}

      {showImage && !loading && onRemove && (
        <Pressable
          accessibilityLabel="Quitar foto"
          className="absolute -top-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 dark:border-surface"
          nativeID={`${idPrefix}-remove-button`}
          onPress={onRemove}
          testID={`${idPrefix}-remove-button`}
        >
          <MaterialCommunityIcons color="#fff" name="trash-can-outline" size={11} />
        </Pressable>
      )}
    </View>
  );
}

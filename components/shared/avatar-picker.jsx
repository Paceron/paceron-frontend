// components/shared/avatar-picker.jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Avatar circular con foto real (si hay `uri`), iniciales (si hay `initials`
// y no hay foto) o ícono default — compartido entre foto de perfil
// (fallbackIcon="account", con iniciales) e ícono de equipo
// (fallbackIcon="account-group", sin iniciales — un equipo no tiene
// "nombre y apellido"). Sin `onPick`, queda de solo lectura: sin lápiz,
// sin basurero, no tocable — mismo componente sirve para "mi perfil"
// (siempre editable) y "detalle de equipo" (editable solo para el
// dueño). `onError` de la imagen cubre el 404/400 conocido del bucket de
// Supabase mientras no estuvo configurado como público (ver
// docs/superpowers/specs/2026-09-03-profile-team-photo-upload-design.md)
// cayendo a iniciales/ícono en vez de mostrar una imagen rota.
export function AvatarPicker({ uri, onPick, onRemove, loading = false, size = 64, fallbackIcon, initials, idPrefix, accessibilityLabel }) {
  const colors = useThemeColors();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  const editable = Boolean(onPick);
  const showImage = Boolean(uri) && !imageFailed;
  const showInitials = !showImage && Boolean(initials);

  return (
    <View className="relative" nativeID={`${idPrefix}-wrapper`} testID={`${idPrefix}-wrapper`}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        className={`items-center justify-center overflow-hidden rounded-full hover:opacity-80 active:opacity-70 ${showInitials ? 'bg-primary-tint dark:bg-primary/15' : 'bg-slate-100 dark:bg-slate-800'}`}
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
        ) : showInitials ? (
          <Text
            className="font-bold text-on-primary-tint dark:text-primary"
            nativeID={`${idPrefix}-initials`}
            style={{ fontSize: size * 0.35 }}
            testID={`${idPrefix}-initials`}
          >
            {initials}
          </Text>
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

import { forwardRef } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

const VARIANTS = {
  ghost: { bg: '', color: 'onSurfaceVariant' },
  neutral: { bg: 'bg-slate-100 dark:bg-slate-800', color: 'onSurfaceVariant' },
  primary: { bg: 'bg-primary', color: 'onPrimary' },
  danger: { bg: 'bg-red-100 dark:bg-red-900/30', color: '#ef4444' },
  success: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', color: '#16a34a' },
  warning: { bg: 'bg-amber-100 dark:bg-amber-900/30', color: '#d97706' },
};

export const IconButton = forwardRef(function IconButton(
  {
    icon,
    label,
    onPress,
    variant = 'neutral',
    size = 36,
    iconSize,
    disabled = false,
    loading = false,
    idPrefix,
    testID,
    accessibilityHint,
    accessibilityState,
    hitSlop,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const colors = useThemeColors();
  const style = VARIANTS[variant] ?? VARIANTS.neutral;
  const iconColor = style.color.startsWith('#') ? style.color : colors[style.color];

  return (
    <Pressable
      {...rest}
      ref={ref}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, ...accessibilityState }}
      className={`${style.bg} items-center justify-center rounded-full active:opacity-70 ${disabled || loading ? 'opacity-50' : ''} ${className}`}
      disabled={disabled || loading}
      hitSlop={hitSlop}
      nativeID={idPrefix}
      onPress={onPress}
      style={{ height: size, width: size }}
      testID={testID ?? idPrefix}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <MaterialCommunityIcons color={iconColor} name={icon} size={iconSize ?? Math.round(size * 0.5)} />
      )}
      {children}
    </Pressable>
  );
});

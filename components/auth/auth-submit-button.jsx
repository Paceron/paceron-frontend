import { ActivityIndicator, Pressable, Text } from 'react-native';

export function AuthSubmitButton({ className = '', idPrefix, label, loading = false, onPress }) {
  return (
    <Pressable
      accessibilityState={{ busy: loading, disabled: loading }}
      className={`h-12 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80 ${loading ? 'opacity-60' : ''} ${className}`}
      disabled={loading}
      nativeID={`${idPrefix}-submit-button`}
      onPress={onPress}
      testID={`${idPrefix}-submit-button`}
    >
      {loading ? (
        <ActivityIndicator color="#111518" size="small" />
      ) : (
        <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-submit-button-label`} testID={`${idPrefix}-submit-button-label`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

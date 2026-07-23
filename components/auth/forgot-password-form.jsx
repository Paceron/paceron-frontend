import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';

export function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [sent, setSent] = useState(false);
  const colors = useThemeColors();

  const handleSend = () => {
    if (!validateEmailFormat(email)) {
      setEmailError('El formato del email no es válido.');
      return;
    }
    if (isDisposableEmail(email)) {
      setEmailError('No se permiten emails temporales o de un solo uso.');
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <View className="items-center py-4" nativeID="forgot-password-form-sent-container" testID="forgot-password-form-sent-container">
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary-tint-subtle dark:bg-primary/10" nativeID="forgot-password-form-sent-icon-wrapper" testID="forgot-password-form-sent-icon-wrapper">
          <MaterialCommunityIcons color={colors.primary} name="email-check-outline" size={40} />
        </View>
        <Text className="mb-3 text-xl font-bold text-slate-900 dark:text-white" nativeID="forgot-password-form-sent-title" testID="forgot-password-form-sent-title">¡Listo!</Text>
        <Text className="mb-1 text-center text-sm leading-6 text-slate-500 dark:text-slate-400" nativeID="forgot-password-form-sent-description" testID="forgot-password-form-sent-description">
          Cuando el backend esté disponible, recibirás las instrucciones de recuperación en
        </Text>
        <Text className="mb-8 text-center text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="forgot-password-form-sent-email" testID="forgot-password-form-sent-email">
          {email}
        </Text>
        <Pressable className="flex-row items-center gap-2 hover:opacity-70" onPress={onBack} nativeID="forgot-password-form-back-button" testID="forgot-password-form-back-button">
          <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={16} />
          <Text className="text-sm font-semibold text-primary" nativeID="forgot-password-form-back-button-label" testID="forgot-password-form-back-button-label">Volver al inicio de sesión</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Text style={{ fontFamily: 'Orbitron_700Bold' }} className="mb-2 text-2xl text-slate-900 dark:text-white" nativeID="forgot-password-form-title" testID="forgot-password-form-title">Recuperar contraseña</Text>
      <Text className="mb-8 text-sm leading-6 text-slate-500 dark:text-slate-400" nativeID="forgot-password-form-subtitle" testID="forgot-password-form-subtitle">
        Ingresá tu email y te enviaremos las instrucciones para restablecer tu contraseña.
      </Text>

      <View className="mb-6" nativeID="forgot-password-form-email-group" testID="forgot-password-form-email-group">
        <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="forgot-password-form-email-label" testID="forgot-password-form-email-label">Email</Text>
        <View className={`h-12 flex-row items-center rounded-xl border ${
          emailError
            ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
        }`} nativeID="forgot-password-form-email-field-wrapper" testID="forgot-password-form-email-field-wrapper">
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            className="flex-1 px-4 text-sm text-slate-900 dark:text-white outline-none"
            keyboardType="email-address"
            onChangeText={(t) => { setEmail(t); setEmailError(null); }}
            placeholder="tu@email.com"
            placeholderTextColor={colors.onSurfaceVariant}
            textContentType="emailAddress"
            value={email}
            nativeID="forgot-password-form-email-input"
            testID="forgot-password-form-email-input"
          />
        </View>
        {emailError && (
          <Text className="mt-1.5 text-xs text-red-500 dark:text-red-400" nativeID="forgot-password-form-email-error" testID="forgot-password-form-email-error">{emailError}</Text>
        )}
      </View>

      <Pressable
        className="mb-5 h-12 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80"
        onPress={handleSend}
        nativeID="forgot-password-form-submit-button"
        testID="forgot-password-form-submit-button"
      >
        <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="forgot-password-form-submit-button-label" testID="forgot-password-form-submit-button-label">
          Enviar instrucciones
        </Text>
      </Pressable>
    </>
  );
}

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
      <View className="items-center py-4">
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary-tint-subtle dark:bg-primary/10">
          <MaterialCommunityIcons color={colors.primary} name="email-check-outline" size={40} />
        </View>
        <Text className="mb-3 text-xl font-bold text-slate-900 dark:text-white">¡Listo!</Text>
        <Text className="mb-1 text-center text-sm leading-6 text-slate-500 dark:text-slate-400">
          Cuando el backend esté disponible, recibirás las instrucciones de recuperación en
        </Text>
        <Text className="mb-8 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
          {email}
        </Text>
        <Pressable className="flex-row items-center gap-2 hover:opacity-70" onPress={onBack}>
          <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={16} />
          <Text className="text-sm font-semibold text-primary">Volver al inicio de sesión</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Text style={{ fontFamily: 'Orbitron_700Bold' }} className="mb-2 text-2xl text-slate-900 dark:text-white">Recuperar contraseña</Text>
      <Text className="mb-8 text-sm leading-6 text-slate-500 dark:text-slate-400">
        Ingresá tu email y te enviaremos las instrucciones para restablecer tu contraseña.
      </Text>

      <View className="mb-6">
        <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">Email</Text>
        <View className={`h-12 flex-row items-center rounded-xl border ${
          emailError
            ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
        }`}>
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
          />
        </View>
        {emailError && (
          <Text className="mt-1.5 text-xs text-red-500 dark:text-red-400">{emailError}</Text>
        )}
      </View>

      <Pressable
        className="mb-5 h-12 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80"
        onPress={handleSend}
      >
        <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]">
          Enviar instrucciones
        </Text>
      </Pressable>
    </>
  );
}

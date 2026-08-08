import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { InputField } from '../forms/fields.jsx';
import { AuthCardShell } from './auth-card-shell.jsx';
import { forgotPassword } from '../../services/password.js';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';

function validateEmail(value) {
  if (!value) return 'El email es requerido.';
  if (!validateEmailFormat(value)) return 'El formato del email no es válido.';
  if (isDisposableEmail(value)) return 'No se permiten emails temporales o de un solo uso.';
  return null;
}

export function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailError = touched ? validateEmail(email) : null;
  const canSubmit = !validateEmail(email);

  const handleSubmit = async () => {
    if (loading) return;
    setTouched(true);
    if (!canSubmit) return;

    setLoading(true);
    try {
      await forgotPassword(email);
      // El backend siempre responde el mismo mensaje genérico (no revela si
      // el email existe) — cualquier 200 se trata como éxito visual.
      router.push({ pathname: '/reset-password', params: { email } });
    } catch {
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: 'Intentá de nuevo más tarde.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCardShell cardClassName="max-w-md p-8">
      <Text
        style={{ fontFamily: 'Orbitron_700Bold' }}
        className="mb-1 text-center text-2xl text-slate-900 dark:text-white"
        nativeID="forgot-password-screen-title"
        testID="forgot-password-screen-title"
      >
        Recuperar contraseña
      </Text>
      <Text
        className="mb-8 text-center text-sm text-slate-500 dark:text-slate-400"
        nativeID="forgot-password-screen-subtitle"
        testID="forgot-password-screen-subtitle"
      >
        Ingresá tu email y te enviamos un código de 6 dígitos para restablecer tu contraseña.
      </Text>

      <InputField
        autoCapitalize="none"
        autoComplete="email"
        error={emailError}
        keyboardType="email-address"
        label="Email"
        onBlur={() => setTouched(true)}
        onChange={setEmail}
        placeholder="tu@email.com"
        returnKeyType="done"
        textContentType="emailAddress"
        touched={touched}
        value={email}
      />

      <Pressable
        className={`mt-2 h-12 items-center justify-center rounded-full ${canSubmit ? 'bg-primary hover:opacity-90' : 'bg-slate-100 dark:bg-slate-800'} active:opacity-80`}
        disabled={loading}
        onPress={handleSubmit}
        nativeID="forgot-password-screen-submit-button"
        testID="forgot-password-screen-submit-button"
      >
        {loading ? (
          <ActivityIndicator color="#111518" size="small" />
        ) : (
          <Text
            className={`text-sm font-semibold uppercase tracking-wide ${canSubmit ? 'text-[#111518]' : 'text-slate-400 dark:text-slate-500'}`}
            nativeID="forgot-password-screen-submit-button-label"
            testID="forgot-password-screen-submit-button-label"
          >
            Enviar código
          </Text>
        )}
      </Pressable>
    </AuthCardShell>
  );
}

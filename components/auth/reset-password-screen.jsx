import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { InputField, Row, Col } from '../forms/fields.jsx';
import { OtpInput } from '../forms/otp-input.jsx';
import { AuthCardShell } from './auth-card-shell.jsx';
import { PasswordRequirementsList, StrengthBar } from '../forms/password-strength.jsx';
import { forgotPassword, resetPassword } from '../../services/password.js';
import { validateOtpCode } from '../../utils/otp-validators.js';
import { isWeb } from '../../utils/platform.js';
import { PASSWORD_MAX_LENGTH, checkPasswordRequirements, isPasswordValid } from '../../utils/password-validators.js';

export function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams();

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Deep-link directo a /reset-password sin pasar por /forgot-password (sin
  // email en los params) — no hay contexto para mostrar nada, se redirige.
  // <Redirect> (no router.replace() en un useEffect) porque esto puede
  // ejecutarse en el primer render de una carga en frío, antes de que el
  // root navigator termine de montar — Redirect maneja esa espera
  // internamente, un router.replace() imperativo ahí tira "Attempted to
  // navigate before mounting the Root Layout component".
  if (!email) return <Redirect href="/forgot-password" />;

  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const codeError = touched.code ? validateOtpCode(code) : null;
  const passwordReqs = checkPasswordRequirements(password);
  const passwordValid = isPasswordValid(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = !validateOtpCode(code) && passwordValid && passwordsMatch;

  const handleSubmit = async () => {
    if (loading) return;
    touch('code');
    touch('password');
    touch('confirm');
    if (!canSubmit) return;

    setLoading(true);
    try {
      await resetPassword({ email, code, newPassword: password, confirmPassword });
      Toast.show({ type: 'success', text1: '¡Contraseña actualizada!', text2: 'Ya podés iniciar sesión.' });
      router.replace('/login');
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo restablecer la contraseña.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await forgotPassword(email);
      Toast.show({ type: 'success', text1: 'Código reenviado', text2: `Revisá ${email}.` });
    } catch {
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: 'Intentá de nuevo más tarde.' });
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthCardShell cardClassName={isWeb ? 'max-w-4xl py-8 px-6' : 'max-w-md py-8 px-6'}>
      <Text
        style={{ fontFamily: 'Orbitron_700Bold' }}
        className="mb-1 text-center text-2xl text-slate-900 dark:text-white"
        nativeID="reset-password-screen-title"
        testID="reset-password-screen-title"
      >
        Ingresá el código
      </Text>
      <Text
        className="mb-8 text-center text-sm text-slate-500 dark:text-slate-400"
        nativeID="reset-password-screen-subtitle"
        testID="reset-password-screen-subtitle"
      >
        Ingresá el código de 6 dígitos que te enviamos, junto con tu nueva contraseña. El código vence a los 10 minutos.
      </Text>

      <InputField disabled label="Email" value={email} />

      <OtpInput error={codeError} label="Código" onChange={(v) => { setCode(v); touch('code'); }} value={code} />

      <Row>
        <Col>
          <InputField
            autoComplete="new-password"
            label="Nueva contraseña"
            onBlur={() => touch('password')}
            onChange={(v) => { if (v.length <= PASSWORD_MAX_LENGTH) setPassword(v); }}
            onToggleSecure={() => setShowPassword((v) => !v)}
            placeholder="Tu nueva contraseña"
            returnKeyType="next"
            secureTextEntry={!showPassword}
            showSecure={showPassword}
            textContentType="newPassword"
            value={password}
          />
        </Col>
        <Col>
          <InputField
            autoComplete="new-password"
            error={touched.confirm && !passwordsMatch && confirmPassword.length > 0 ? 'Las contraseñas no coinciden.' : null}
            label="Confirmar contraseña"
            onBlur={() => touch('confirm')}
            onChange={setConfirmPassword}
            onToggleSecure={() => setShowConfirm((v) => !v)}
            placeholder="Repetí tu nueva contraseña"
            returnKeyType="done"
            secureTextEntry={!showConfirm}
            showSecure={showConfirm}
            textContentType="newPassword"
            value={confirmPassword}
          />
        </Col>
      </Row>

      <PasswordRequirementsList reqs={passwordReqs} />
      <StrengthBar password={password} />

      <Pressable
        className={`mt-8 h-12 items-center justify-center rounded-full ${canSubmit ? 'bg-primary hover:opacity-90' : 'bg-slate-100 dark:bg-slate-800'} active:opacity-80`}
        disabled={loading}
        onPress={handleSubmit}
        nativeID="reset-password-screen-submit-button"
        testID="reset-password-screen-submit-button"
      >
        {loading ? (
          <ActivityIndicator color="#111518" size="small" />
        ) : (
          <Text
            className={`text-sm font-semibold uppercase tracking-wide ${canSubmit ? 'text-[#111518]' : 'text-slate-400 dark:text-slate-500'}`}
            nativeID="reset-password-screen-submit-button-label"
            testID="reset-password-screen-submit-button-label"
          >
            Restablecer contraseña
          </Text>
        )}
      </Pressable>

      <Pressable
        className="mt-6 items-center py-1 hover:opacity-70"
        disabled={resending}
        onPress={handleResend}
        nativeID="reset-password-screen-resend-button"
        testID="reset-password-screen-resend-button"
      >
        <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="reset-password-screen-resend-label" testID="reset-password-screen-resend-label">
          {resending ? 'Reenviando...' : '¿No recibiste el código? Reenviar'}
        </Text>
      </Pressable>
    </AuthCardShell>
  );
}

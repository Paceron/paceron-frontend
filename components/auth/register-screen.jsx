import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';
import { PASSWORD_MAX_LENGTH, checkPasswordRequirements, isPasswordValid } from '../../utils/password-validators.js';
import { validateBirthDate } from '../../utils/date-validators.js';
import { validateDNI } from '../../utils/dni-validators.js';
import { toRegisterPayload } from '../../services/normalizers.js';
import { useAuthStore } from '../../store/auth-store.js';
import { isWeb } from '../../utils/platform.js';
import { Row, Col, SelectField, DateField, InputField, PickerField } from '../forms/fields.jsx';
import { SectionCard } from '../forms/section-card.jsx';
import { useAddressCascade } from '../../hooks/use-address-cascade.js';
import { AuthCardShell } from './auth-card-shell.jsx';
import { StrengthBar, PasswordRequirementsList } from '../forms/password-strength.jsx';
import { CheckboxField } from '../forms/checkbox-field.jsx';
import { TermsModal } from '../legal/terms-modal.jsx';

export function RegisterScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneContact, setPhoneContact] = useState('');

  const [openSection, setOpenSection] = useState('personal');

  const toggleSection = (id) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const {
    country,
    province,
    city,
    street,
    number,
    setStreet,
    setNumber,
    provinceOptions,
    cityOptions,
    countryOptions,
    handleCountryChange,
    handleProvinceChange,
    handleCityChange,
  } = useAddressCascade();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const [touched, setTouched] = useState({});
  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const emailError = touched.email && !email
    ? 'El email es requerido.'
    : touched.email && !validateEmailFormat(email)
    ? 'El formato del email no es válido.'
    : touched.email && isDisposableEmail(email)
    ? 'No se permiten emails temporales o de un solo uso.'
    : null;

  const dniError = touched.dni && validateDNI(dni);
  const dateError = touched.birthDate && validateBirthDate(birthDate);

  const passwordReqs = checkPasswordRequirements(password);
  const passwordValid = isPasswordValid(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const personalOk =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    !validateDNI(dni) &&
    !validateBirthDate(birthDate) &&
    validateEmailFormat(email) &&
    !isDisposableEmail(email);
  const formValid = personalOk && passwordValid && passwordsMatch && termsAccepted;

  const termsError =
    touched.terms && !termsAccepted
      ? 'Debe aceptar los términos y condiciones para continuar.'
      : null;

  const handleSubmit = async () => {
    if (loading) return;
    touch('firstName');
    touch('lastName');
    touch('dni');
    touch('birthDate');
    touch('email');
    touch('password');
    touch('confirm');
    touch('terms');

    if (!formValid) return;

    setLoading(true);
    try {
      const { register } = useAuthStore.getState();
      const result = await register(
        toRegisterPayload({
          firstName,
          lastName,
          dni,
          birthDate,
          email,
          phone,
          phoneContact,
          country,
          province,
          city,
          street,
          number,
          password,
        }),
      );
      if (result.success) {
        Toast.show({ type: 'success', text1: '¡Cuenta creada!', text2: 'Bienvenido a Paceron.' });
        router.replace('/');
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'Error al crear la cuenta.' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: 'Intentá de nuevo más tarde.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCardShell cardClassName={isWeb ? 'max-w-4xl py-8 px-6' : 'max-w-md py-8 px-6'}>
      <Text style={{ fontFamily: 'Orbitron_700Bold' }} className="mb-1 text-center text-2xl text-slate-900 dark:text-white" nativeID="register-screen-title" testID="register-screen-title">Crear cuenta</Text>
      <Text className="mb-8 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="register-screen-subtitle" testID="register-screen-subtitle">
        Completá tus datos para registrarte en Paceron.
      </Text>

      <SectionCard collapsible collapsed={openSection !== 'personal'} icon="account-details" onToggle={() => toggleSection('personal')} title="Datos personales">
        <Row>
          <Col>
            <InputField
              autoCapitalize="words"
              autoComplete="given-name"
              error={touched.firstName && !firstName.trim() ? 'El nombre es requerido.' : null}
              label="Nombre *"
              onBlur={() => touch('firstName')}
              onChange={setFirstName}
              placeholder="Tu nombre"
              returnKeyType="next"
              textContentType="givenName"
              touched={touched.firstName}
              value={firstName}
            />
          </Col>
          <Col>
            <InputField
              autoCapitalize="words"
              autoComplete="family-name"
              error={touched.lastName && !lastName.trim() ? 'Los apellidos son requeridos.' : null}
              label="Apellidos *"
              onBlur={() => touch('lastName')}
              onChange={setLastName}
              placeholder="Tus apellidos"
              returnKeyType="next"
              textContentType="familyName"
              touched={touched.lastName}
              value={lastName}
            />
          </Col>
        </Row>

        <InputField
          autoCapitalize="none"
          autoComplete="email"
          error={emailError}
          keyboardType="email-address"
          label="Email *"
          onBlur={() => touch('email')}
          onChange={setEmail}
          placeholder="tu@email.com"
          returnKeyType="next"
          textContentType="emailAddress"
          touched={touched.email}
          value={email}
        />

        <Row>
          <Col flex={1.3}>
            <DateField
              error={typeof dateError === 'string' ? dateError : null}
              label="Fecha de nacimiento *"
              onBlur={() => touch('birthDate')}
              onChange={setBirthDate}
              touched={touched.birthDate}
              value={birthDate}
            />
          </Col>
          <Col>
            <InputField
              autoCapitalize="none"
              autoComplete="off"
              error={typeof dniError === 'string' ? dniError : null}
              keyboardType="number-pad"
              label="DNI *"
              onBlur={() => touch('dni')}
              onChange={(v) => setDni(v.replace(/\D/g, ''))}
              placeholder="Solo números"
              returnKeyType="next"
              touched={touched.dni}
              value={dni}
            />
          </Col>
        </Row>

        <Row>
          <Col>
            <InputField
              autoCapitalize="none"
              autoComplete="tel"
              keyboardType="phone-pad"
              label="Teléfono"
              onChange={setPhone}
              placeholder="+54 11 1234 5678"
              returnKeyType="next"
              textContentType="telephoneNumber"
              value={phone}
            />
          </Col>
          <Col>
            <InputField
              autoCapitalize="none"
              autoComplete="tel"
              keyboardType="phone-pad"
              label="Teléfono de contacto"
              onChange={setPhoneContact}
              placeholder="Otro número de contacto"
              returnKeyType="next"
              textContentType="telephoneNumber"
              value={phoneContact}
            />
          </Col>
        </Row>
      </SectionCard>

      <SectionCard collapsible collapsed={openSection !== 'address'} icon="map-marker" onToggle={() => toggleSection('address')} title="Dirección">
        <Row>
          <Col>
            {isWeb ? (
              <SelectField
                label="País"
                onChange={handleCountryChange}
                options={countryOptions}
                placeholder="Seleccioná un país"
                value={country}
              />
            ) : (
              <PickerField
                label="País"
                onChange={handleCountryChange}
                options={countryOptions}
                placeholder="Seleccioná un país"
                value={country}
              />
            )}
          </Col>
          <Col>
            {isWeb ? (
              <SelectField
                disabled={!country}
                label="Provincia"
                onChange={handleProvinceChange}
                options={provinceOptions}
                placeholder={country ? 'Seleccioná una provincia' : 'Elegí un país'}
                value={province}
              />
            ) : (
              <PickerField
                disabled={!country}
                label="Provincia"
                onChange={handleProvinceChange}
                options={provinceOptions}
                placeholder={country ? 'Seleccioná una provincia' : 'Elegí un país'}
                value={province}
              />
            )}
          </Col>
          <Col>
            {isWeb ? (
              <SelectField
                disabled={!province}
                label="Localidad"
                onChange={handleCityChange}
                options={cityOptions}
                placeholder={province ? 'Seleccioná una localidad' : 'Elegí una provincia'}
                value={city}
              />
            ) : (
              <PickerField
                disabled={!province}
                label="Localidad"
                onChange={handleCityChange}
                options={cityOptions}
                placeholder={province ? 'Seleccioná una localidad' : 'Elegí una provincia'}
                value={city}
              />
            )}
          </Col>
        </Row>

        <Row>
          <Col flex={3}>
            <InputField
              autoCapitalize="words"
              disabled={!city}
              label="Calle"
              onChange={setStreet}
              placeholder={city ? 'Nombre de la calle' : 'Elegí una localidad primero'}
              returnKeyType="next"
              value={street}
            />
          </Col>
          <Col flex={1}>
            <InputField
              autoCapitalize="none"
              disabled={!city}
              keyboardType="number-pad"
              label="Altura"
              onChange={(v) => setNumber(v.replace(/\D/g, ''))}
              placeholder={city ? '1234' : '—'}
              returnKeyType="next"
              value={number}
            />
          </Col>
        </Row>
      </SectionCard>

      <SectionCard collapsible collapsed={openSection !== 'password'} icon="lock-outline" onToggle={() => toggleSection('password')} title="Contraseña">
        <Row>
          <Col>
            <InputField
              autoComplete="new-password"
              label="Contraseña *"
              onBlur={() => touch('password')}
              onChange={(v) => { if (v.length <= PASSWORD_MAX_LENGTH) setPassword(v); }}
              onToggleSecure={() => setShowPassword((v) => !v)}
              placeholder="Tu contraseña"
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
              label="Confirmar contraseña *"
              onBlur={() => touch('confirm')}
              onChange={setConfirmPassword}
              onToggleSecure={() => setShowConfirm((v) => !v)}
              placeholder="Repetí tu contraseña"
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
      </SectionCard>

      <CheckboxField
        checked={termsAccepted}
        error={termsError}
        idPrefix="register-screen-terms"
        onChange={setTermsAccepted}
      >
        <Text
          className="text-sm text-slate-600 dark:text-slate-300"
          nativeID="register-screen-terms-text"
          testID="register-screen-terms-text"
        >
          Acepto los{' '}
          <Text
            className="font-semibold text-primary"
            nativeID="register-screen-terms-link"
            testID="register-screen-terms-link"
            onPress={() => setShowTerms(true)}
          >
            Términos y Condiciones
          </Text>
        </Text>
      </CheckboxField>

      <TermsModal onClose={() => setShowTerms(false)} visible={showTerms} />

      <Pressable
        className={`mt-8 h-12 items-center justify-center rounded-full ${
          formValid ? 'bg-primary hover:opacity-90' : 'bg-slate-100 dark:bg-slate-800'
        } active:opacity-80`}
        disabled={loading}
        onPress={handleSubmit}
        nativeID="register-screen-submit-button"
        testID="register-screen-submit-button"
      >
        {loading ? (
          <ActivityIndicator color="#111518" size="small" />
        ) : (
          <Text className={`text-sm font-semibold uppercase tracking-wide ${
            formValid ? 'text-[#111518]' : 'text-slate-400 dark:text-slate-500'
          }`} nativeID="register-screen-submit-button-label" testID="register-screen-submit-button-label">
            Crear cuenta
          </Text>
        )}
      </Pressable>

      <Pressable className="mt-6 items-center py-1 hover:opacity-70" onPress={() => router.push('/login')} nativeID="register-screen-login-link-button" testID="register-screen-login-link-button">
        <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="register-screen-login-link-label" testID="register-screen-login-link-label">
          ¿Ya tenés cuenta?{' '}
          <Text className="font-semibold text-primary" nativeID="register-screen-login-link-emphasis" testID="register-screen-login-link-emphasis">Iniciá sesión</Text>
        </Text>
      </Pressable>
    </AuthCardShell>
  );
}

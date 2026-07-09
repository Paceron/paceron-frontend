import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';
import {
  PASSWORD_REQUIREMENTS,
  PASSWORD_MAX_LENGTH,
  checkPasswordRequirements,
  isPasswordValid,
  getPasswordStrengthScore,
  getPasswordStrengthMeta,
} from '../../utils/password-validators.js';
import { validateBirthDate } from '../../utils/date-validators.js';
import { validateDNI } from '../../utils/dni-validators.js';
import { toRegisterPayload } from '../../services/normalizers.js';
import { useAuthStore } from '../../store/auth-store.js';
import { PaceronBrand } from '../brand/paceron-brand.jsx';
import { isWeb } from '../../utils/platform.js';
import { Row, Col, SelectField, DateField, InputField, PickerField } from '../forms/fields.jsx';
import { useAddressCascade } from '../../hooks/use-address-cascade.js';

function StrengthBar({ password }) {
  const score = getPasswordStrengthScore(password);
  const total = PASSWORD_REQUIREMENTS.length;
  const pct = Math.round((score / total) * 100);
  const { label, color } = getPasswordStrengthMeta(score);

  return (
    <View className="mb-3 mt-2">
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <View style={{ width: `${pct}%`, backgroundColor: color }} className="h-full rounded-full" />
      </View>
      {password.length > 0 && (
        <Text style={{ color }} className="mt-1 text-xs font-semibold">
          {label}
        </Text>
      )}
    </View>
  );
}

function RequirementRow({ met, label }) {
  const colors = useThemeColors();
  return (
    <View className="mb-1 flex-row items-center gap-2">
      <MaterialCommunityIcons
        color={met ? '#8cc63e' : colors.onSurfaceVariant}
        name={met ? 'check-circle' : 'circle-outline'}
        size={14}
      />
      <Text className={`text-xs ${met ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`}>
        {label}
      </Text>
    </View>
  );
}

function SectionCollapsible({ title, children, collapsed, onToggle }) {
  const colors = useThemeColors();
  const rotateAnim = useSharedValue(collapsed ? 1 : 0);

  useEffect(() => {
    rotateAnim.value = withTiming(collapsed ? 1 : 0, { duration: 200 });
  }, [collapsed]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotateAnim.value, [0, 1], [0, -90])}deg` }],
  }));

  return (
    <View className="mb-6">
      <Pressable
        className="flex-row items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800"
        onPress={onToggle}
      >
        <Animated.View style={chevronStyle}>
          <MaterialCommunityIcons name="chevron-down" size={18} color={colors.onSurfaceVariant} />
        </Animated.View>
        <Text className="text-lg font-bold text-slate-900 dark:text-white">{title}</Text>
      </Pressable>
      {!collapsed && <View className="mt-6">{children}</View>}
    </View>
  );
}

export function RegisterScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneContact, setPhoneContact] = useState('');

  const [collapsedSections, setCollapsedSections] = useState({
    personal: false,
    address: false,
    password: false,
  });

  const toggleSection = (id) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
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
  const formValid = personalOk && passwordValid && passwordsMatch;

  const handleSubmit = async () => {
    if (loading) return;
    touch('firstName');
    touch('lastName');
    touch('dni');
    touch('birthDate');
    touch('email');
    touch('password');
    touch('confirm');

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

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const handleBackNav = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-ink" edges={['top', 'bottom']}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={24}
      >
        <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 }, animatedStyle]}>
            <View className={`w-full ${isWeb ? 'max-w-4xl' : 'max-w-md'} rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-surface`}>
              <Pressable
                className="-ml-2 mb-4 flex-row items-center gap-1.5 self-start rounded-lg px-2 py-1.5 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
                onPress={handleBackNav}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={16} />
                <Text className="text-sm text-slate-600 dark:text-slate-300">Volver</Text>
              </Pressable>

              <View className="mb-8 items-center">
                <Image
                  resizeMode="contain"
                  source={require('../../assets/paceron-symbol-transparent.png')}
                  style={{ width: 48, height: 48 }}
                />
                <PaceronBrand size={16} style={{ marginTop: 8 }} />
              </View>

              <Text style={{ fontFamily: 'Orbitron_700Bold' }} className="mb-1 text-center text-2xl text-slate-900 dark:text-white">Crear cuenta</Text>
              <Text className="mb-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Completá tus datos para registrarte en Paceron.
              </Text>

              <SectionCollapsible title="Datos personales" collapsed={collapsedSections.personal} onToggle={() => toggleSection('personal')}>
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
                    {isWeb ? (
                      <DateField
                        error={typeof dateError === 'string' ? dateError : null}
                        label="Fecha de nacimiento *"
                        onBlur={() => touch('birthDate')}
                        onChange={setBirthDate}
                        touched={touched.birthDate}
                        value={birthDate}
                      />
                    ) : (
                      <InputField
                        autoCapitalize="none"
                        autoComplete="bday"
                        error={typeof dateError === 'string' ? dateError : null}
                        keyboardType="default"
                        label="Fecha de nacimiento *"
                        onBlur={() => touch('birthDate')}
                        onChange={setBirthDate}
                        placeholder="DD/MM/AAAA"
                        returnKeyType="next"
                        touched={touched.birthDate}
                        value={birthDate}
                      />
                    )}
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
              </SectionCollapsible>

              <SectionCollapsible title="Dirección" collapsed={collapsedSections.address} onToggle={() => toggleSection('address')}>
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
              </SectionCollapsible>

              <SectionCollapsible title="Contraseña" collapsed={collapsedSections.password} onToggle={() => toggleSection('password')}>
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

                <View className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                  {PASSWORD_REQUIREMENTS.map((req) => (
                    <RequirementRow key={req.id} label={req.label} met={passwordReqs[req.id]} />
                  ))}
                </View>

                <StrengthBar password={password} />
              </SectionCollapsible>

              <Pressable
                className={`mt-8 h-12 items-center justify-center rounded-full ${
                  formValid ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800'
                } active:opacity-80`}
                disabled={loading}
                onPress={handleSubmit}
              >
                {loading ? (
                  <ActivityIndicator color="#111518" size="small" />
                ) : (
                  <Text className={`text-sm font-semibold uppercase tracking-wide ${
                    formValid ? 'text-[#111518]' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    Crear cuenta
                  </Text>
                )}
              </Pressable>

              <Pressable className="mt-6 items-center py-1" onPress={() => router.push('/login')}>
                <Text className="text-sm text-slate-500 dark:text-slate-400">
                  ¿Ya tenés cuenta?{' '}
                  <Text className="font-semibold text-primary">Iniciá sesión</Text>
                </Text>
              </Pressable>
            </View>
        </Animated.View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

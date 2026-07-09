import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';
import { validateBirthDate } from '../../utils/date-validators.js';
import { validateDNI } from '../../utils/dni-validators.js';
import { toUpdatePayload } from '../../services/normalizers.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useAddressCascade } from '../../hooks/use-address-cascade.js';
import { Row, Col, InputField, DateField, SelectField, PickerField } from '../forms/fields.jsx';

// DD/MM/YYYY -> YYYY-MM-DD para el <input type="date"> de web.
function toDateInput(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : value || '';
}

function SectionTitle({ children }) {
  return (
    <Text className="mb-4 mt-2 border-b border-slate-100 pb-2 text-lg font-bold text-slate-900 dark:border-slate-800 dark:text-white">
      {children}
    </Text>
  );
}

// Guard: TabsLayout ya asegura que la sesión esté hidratada antes de montar
// esta pantalla. El form vive en un componente hijo que solo se monta con
// `user` presente, para que los useState pre-carguen con los valores reales.
export function EditProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) router.replace('/login');
  }, [user]);

  if (!user) return null;
  return <EditProfileForm user={user} />;
}

function EditProfileForm({ user }) {
  const router = useRouter();
  const colors = useThemeColors();

  const [firstName, setFirstName] = useState(user.name ?? '');
  const [lastName, setLastName] = useState(user.surname ?? '');
  const [dni, setDni] = useState(user.dni ?? '');
  const [birthDate, setBirthDate] = useState(isWeb ? toDateInput(user.birthDate) : user.birthDate ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [phoneContact, setPhoneContact] = useState(user.phoneContact ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const address = useAddressCascade({
    country: user.country,
    province: user.province,
    city: user.city,
    street: user.street,
    number: user.number,
  });

  const emailChanged = email.trim().toLowerCase() !== (user.email ?? '').toLowerCase();

  const emailError = touched.email && !email
    ? 'El email es requerido.'
    : touched.email && !validateEmailFormat(email)
    ? 'El formato del email no es válido.'
    : touched.email && isDisposableEmail(email)
    ? 'No se permiten emails temporales o de un solo uso.'
    : null;
  const dniError = touched.dni && validateDNI(dni);
  const dateError = touched.birthDate && validateBirthDate(birthDate);
  const currentPasswordError = emailChanged && touched.currentPassword && !currentPassword
    ? 'Ingresá tu contraseña actual para cambiar el email.'
    : null;

  const personalOk =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    !validateDNI(dni) &&
    !validateBirthDate(birthDate) &&
    validateEmailFormat(email) &&
    !isDisposableEmail(email);
  const canSubmit = personalOk && (!emailChanged || currentPassword.length > 0);

  const handleSubmit = async () => {
    if (loading) return;
    touch('firstName');
    touch('lastName');
    touch('dni');
    touch('birthDate');
    touch('email');
    if (emailChanged) touch('currentPassword');

    if (!personalOk) return;
    if (emailChanged && !currentPassword) return;

    setLoading(true);
    try {
      const payload = toUpdatePayload({
        firstName,
        lastName,
        dni,
        birthDate,
        email,
        phone,
        phoneContact,
        country: address.country,
        province: address.province,
        city: address.city,
        street: address.street,
        number: address.number,
      });
      const result = await useAuthStore.getState().updateUser(
        user.userId,
        payload,
        emailChanged ? currentPassword : undefined,
      );
      if (result.success) {
        Toast.show({ type: 'success', text1: 'Datos actualizados', text2: 'Tu perfil se guardó correctamente.' });
        router.replace('/profile');
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'No se pudieron guardar los cambios.' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: 'Intentá de nuevo más tarde.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-slate-50 dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      enableOnAndroid
      extraScrollHeight={24}
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`}>
        <Pressable
          className="mb-6 flex-row items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 py-2 active:opacity-70 dark:border-slate-700 dark:bg-surface"
          onPress={() => router.replace('/profile')}
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={16} />
          <Text className="text-sm text-slate-600 dark:text-slate-300">Volver</Text>
        </Pressable>

        <Text
          style={{ fontFamily: 'Orbitron_700Bold' }}
          className="mb-8 text-2xl text-slate-900 dark:text-white"
        >
          Editar datos
        </Text>

        <SectionTitle>Datos personales</SectionTitle>
        <Row>
          <Col>
            <InputField
              autoCapitalize="words"
              error={touched.firstName && !firstName.trim() ? 'El nombre es requerido.' : null}
              label="Nombre *"
              onBlur={() => touch('firstName')}
              onChange={setFirstName}
              placeholder="Tu nombre"
              touched={touched.firstName}
              value={firstName}
            />
          </Col>
          <Col>
            <InputField
              autoCapitalize="words"
              error={touched.lastName && !lastName.trim() ? 'Los apellidos son requeridos.' : null}
              label="Apellidos *"
              onBlur={() => touch('lastName')}
              onChange={setLastName}
              placeholder="Tus apellidos"
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
          textContentType="emailAddress"
          touched={touched.email}
          value={email}
        />

        {emailChanged && (
          <InputField
            autoComplete="current-password"
            error={currentPasswordError}
            label="Contraseña actual *"
            onBlur={() => touch('currentPassword')}
            onChange={setCurrentPassword}
            onToggleSecure={() => setShowCurrent((v) => !v)}
            placeholder="Requerida para cambiar el email"
            secureTextEntry={!showCurrent}
            showSecure={showCurrent}
            textContentType="password"
            touched={touched.currentPassword}
            value={currentPassword}
          />
        )}

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
                error={typeof dateError === 'string' ? dateError : null}
                label="Fecha de nacimiento *"
                onBlur={() => touch('birthDate')}
                onChange={setBirthDate}
                placeholder="DD/MM/AAAA"
                touched={touched.birthDate}
                value={birthDate}
              />
            )}
          </Col>
          <Col>
            <InputField
              autoCapitalize="none"
              error={typeof dniError === 'string' ? dniError : null}
              keyboardType="number-pad"
              label="DNI *"
              onBlur={() => touch('dni')}
              onChange={(v) => setDni(v.replace(/\D/g, ''))}
              placeholder="Solo números"
              touched={touched.dni}
              value={dni}
            />
          </Col>
        </Row>

        <Row>
          <Col>
            <InputField
              autoCapitalize="none"
              keyboardType="phone-pad"
              label="Teléfono"
              onChange={setPhone}
              placeholder="+54 11 1234 5678"
              value={phone}
            />
          </Col>
          <Col>
            <InputField
              autoCapitalize="none"
              keyboardType="phone-pad"
              label="Teléfono de contacto"
              onChange={setPhoneContact}
              placeholder="Otro número de contacto"
              value={phoneContact}
            />
          </Col>
        </Row>

        <SectionTitle>Dirección</SectionTitle>
        <Row>
          <Col>
            {isWeb ? (
              <SelectField label="País" onChange={address.handleCountryChange} options={address.countryOptions} placeholder="Seleccioná un país" value={address.country} />
            ) : (
              <PickerField label="País" onChange={address.handleCountryChange} options={address.countryOptions} placeholder="Seleccioná un país" value={address.country} />
            )}
          </Col>
          <Col>
            {isWeb ? (
              <SelectField disabled={!address.country} label="Provincia" onChange={address.handleProvinceChange} options={address.provinceOptions} placeholder={address.country ? 'Seleccioná una provincia' : 'Elegí un país'} value={address.province} />
            ) : (
              <PickerField disabled={!address.country} label="Provincia" onChange={address.handleProvinceChange} options={address.provinceOptions} placeholder={address.country ? 'Seleccioná una provincia' : 'Elegí un país'} value={address.province} />
            )}
          </Col>
          <Col>
            {isWeb ? (
              <SelectField disabled={!address.province} label="Localidad" onChange={address.handleCityChange} options={address.cityOptions} placeholder={address.province ? 'Seleccioná una localidad' : 'Elegí una provincia'} value={address.city} />
            ) : (
              <PickerField disabled={!address.province} label="Localidad" onChange={address.handleCityChange} options={address.cityOptions} placeholder={address.province ? 'Seleccioná una localidad' : 'Elegí una provincia'} value={address.city} />
            )}
          </Col>
        </Row>
        <Row>
          <Col flex={3}>
            <InputField
              autoCapitalize="words"
              disabled={!address.city}
              label="Calle"
              onChange={address.setStreet}
              placeholder={address.city ? 'Nombre de la calle' : 'Elegí una localidad primero'}
              value={address.street}
            />
          </Col>
          <Col flex={1}>
            <InputField
              autoCapitalize="none"
              disabled={!address.city}
              keyboardType="number-pad"
              label="Altura"
              onChange={(v) => address.setNumber(v.replace(/\D/g, ''))}
              placeholder={address.city ? '1234' : '—'}
              value={address.number}
            />
          </Col>
        </Row>

        <Pressable
          className={`mt-4 h-12 flex-row items-center justify-center gap-2 rounded-full ${canSubmit ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800'} active:opacity-80`}
          disabled={loading}
          onPress={handleSubmit}
        >
          {loading ? (
            <ActivityIndicator color="#111518" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons color={canSubmit ? colors.onPrimary : colors.onSurfaceVariant} name="content-save" size={18} />
              <Text className={`text-sm font-semibold uppercase tracking-wide ${canSubmit ? 'text-[#111518]' : 'text-slate-400 dark:text-slate-500'}`}>
                Guardar cambios
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAwareScrollView>
  );
}

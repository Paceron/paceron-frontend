import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, getTeamMemberLimit } from '../../store/team-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { EmailListField, InputField, PickerField, Row, Col } from '../forms/fields.jsx';

const LEVEL_OPTIONS = [
  { id: 'amateur', name: 'Amateur' },
  { id: 'semi-profesional', name: 'Semi-profesional' },
  { id: 'profesional', name: 'Profesional' },
];

export function CreateTeamScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const roles = useAuthStore((s) => s.roles);
  const createTeam = useTeamStore((s) => s.createTeam);

  const trainerTier = roles.find((r) => r.name === 'entrenador')?.tier;
  const maxAllowed = getTeamMemberLimit(trainerTier);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [maxMembers, setMaxMembers] = useState('');
  // Por ahora es texto libre. A futuro pasa a ser una seleccion de
  // requerimientos estandarizados (combobox) en vez de texto — ver spec.
  const [requirements, setRequirements] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [invitedEmails, setInvitedEmails] = useState([]);
  const [errors, setErrors] = useState({});

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'Permiso necesario', text2: 'Habilitá el acceso a tus fotos para elegir una imagen.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Ingresá un nombre para el equipo.';
    if (!level) next.level = 'Elegí un nivel.';

    const parsedMax = Number(maxMembers);
    if (!maxMembers.trim() || !Number.isInteger(parsedMax) || parsedMax < 1) {
      next.maxMembers = 'Ingresá una cantidad válida.';
    } else if (parsedMax > maxAllowed) {
      next.maxMembers = `Tu plan permite hasta ${maxAllowed} integrantes.`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    createTeam({
      name: name.trim(),
      description: description.trim(),
      requirements: requirements.trim(),
      level,
      maxMembers: Number(maxMembers),
      photoUri,
      invitedEmails,
    });

    Toast.show({
      type: 'success',
      text1: 'Equipo creado',
      text2: invitedEmails.length > 0
        ? 'Las invitaciones se van a enviar cuando el backend de equipos esté disponible.'
        : 'Ya lo vas a encontrar en el menú de Equipos.',
    });

    router.back();
  };

  return (
    <ScrollView
      nativeID="create-team-screen-scroll"
      testID="create-team-screen-scroll"
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      showsVerticalScrollIndicator={false}
    >
      <View nativeID="create-team-screen-container" testID="create-team-screen-container" className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`}>
        <View nativeID="create-team-screen-header" testID="create-team-screen-header" className="mb-8 flex-row items-center gap-2">
          <Pressable
            nativeID="create-team-screen-back-button"
            testID="create-team-screen-back-button"
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text
            nativeID="create-team-screen-title"
            testID="create-team-screen-title"
            style={{ fontFamily: 'Orbitron_700Bold' }}
            className="text-xl text-slate-900 dark:text-white"
          >
            Crear equipo
          </Text>
        </View>

        <SectionCard icon="account-group" title="Datos del equipo">
          <View className="flex-row items-start gap-4" nativeID="create-team-identity-row" testID="create-team-identity-row">
            <View className="relative mt-[26px]" nativeID="create-team-photo-wrapper" testID="create-team-photo-wrapper">
              <Pressable
                accessibilityLabel={photoUri ? 'Cambiar foto del equipo' : 'Agregar foto del equipo'}
                className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-100 hover:opacity-80 active:opacity-70 dark:bg-slate-800"
                nativeID="create-team-photo-picker"
                onPress={handlePickPhoto}
                testID="create-team-photo-picker"
              >
                {photoUri ? (
                  <Image
                    accessibilityLabel="Foto de perfil del equipo"
                    className="h-12 w-12 rounded-full"
                    nativeID="create-team-photo-preview-image"
                    source={{ uri: photoUri }}
                    testID="create-team-photo-preview-image"
                  />
                ) : (
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="camera-plus-outline" size={20} />
                )}
              </Pressable>
              {photoUri && (
                <View
                  className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-primary dark:border-surface"
                  nativeID="create-team-photo-edit-badge"
                  pointerEvents="none"
                  testID="create-team-photo-edit-badge"
                >
                  <MaterialCommunityIcons color={colors.onPrimary} name="pencil" size={11} />
                </View>
              )}
            </View>

            <View className="flex-1" nativeID="create-team-name-wrapper" testID="create-team-name-wrapper">
              <InputField dense label="Nombre del equipo" onChange={setName} value={name} error={errors.name} placeholder="Ej. Corredores del Sur" />
            </View>
          </View>

          <InputField
            dense
            label="Descripción del equipo"
            multiline
            numberOfLines={3}
            onChange={setDescription}
            placeholder="Contales a los corredores de qué se trata este equipo."
            value={description}
          />

          <Row>
            <Col>
              <PickerField
                dense
                label="Nivel del equipo"
                onChange={setLevel}
                options={LEVEL_OPTIONS}
                placeholder="Elegir nivel"
                value={level}
                error={errors.level}
              />
            </Col>
            <Col>
              <InputField
                dense
                label="Máx. de integrantes"
                hint={`Tu plan permite hasta ${maxAllowed}.`}
                keyboardType="number-pad"
                onChange={setMaxMembers}
                placeholder={String(maxAllowed)}
                value={maxMembers}
                error={errors.maxMembers}
              />
            </Col>
          </Row>

          <InputField
            dense
            label="Requerimientos de entrada al equipo"
            multiline
            numberOfLines={3}
            onChange={setRequirements}
            placeholder="Ej. Ritmo promedio, disponibilidad horaria, experiencia previa."
            value={requirements}
          />

          <EmailListField label="Invitar corredores por email" onChange={setInvitedEmails} value={invitedEmails} />

          <Pressable
            className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80"
            nativeID="create-team-submit-button"
            onPress={handleSubmit}
            testID="create-team-submit-button"
          >
            <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
            <Text
              className="text-sm font-semibold uppercase tracking-wide text-[#111518]"
              nativeID="create-team-submit-button-label"
              testID="create-team-submit-button-label"
            >
              Crear
            </Text>
          </Pressable>
        </SectionCard>
      </View>
    </ScrollView>
  );
}

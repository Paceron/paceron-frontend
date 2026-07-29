import { Image, Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { InputField, PickerField, Row, Col, SelectField } from '../forms/fields.jsx';

const LEVEL_OPTIONS = [
  { id: 'amateur', name: 'Amateur' },
  { id: 'semi-profesional', name: 'Semi-profesional' },
  { id: 'profesional', name: 'Profesional' },
];

// Campos de "datos generales" de un equipo — compartidos por
// CreateTeamScreen (paso 1 del wizard) y EditTeamScreen (pantalla única).
// `form` viene de hooks/use-team-general-info-form.js. `idPrefix` distingue
// los nativeID/testID de los wrappers propios de este bloque entre
// pantallas (nunca están montadas a la vez, pero mantiene los ids legibles
// para debug).
export function TeamGeneralInfoFields({ form, maxAllowed, idPrefix }) {
  const colors = useThemeColors();

  return (
    <>
      <View className="flex-row items-start gap-4" nativeID={`${idPrefix}-identity-row`} testID={`${idPrefix}-identity-row`}>
        <View className="relative mt-[26px]" nativeID={`${idPrefix}-photo-wrapper`} testID={`${idPrefix}-photo-wrapper`}>
          <Pressable
            accessibilityLabel={form.photoUri ? 'Cambiar foto del equipo' : 'Agregar foto del equipo'}
            className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-100 hover:opacity-80 active:opacity-70 dark:bg-slate-800"
            nativeID={`${idPrefix}-photo-picker`}
            onPress={form.handlePickPhoto}
            testID={`${idPrefix}-photo-picker`}
          >
            {form.photoUri ? (
              <Image
                accessibilityLabel="Foto de perfil del equipo"
                className="h-12 w-12 rounded-full"
                nativeID={`${idPrefix}-photo-preview-image`}
                source={{ uri: form.photoUri }}
                testID={`${idPrefix}-photo-preview-image`}
              />
            ) : (
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="camera-plus-outline" size={20} />
            )}
          </Pressable>
          {form.photoUri && (
            <View
              className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-primary dark:border-surface"
              nativeID={`${idPrefix}-photo-edit-badge`}
              pointerEvents="none"
              testID={`${idPrefix}-photo-edit-badge`}
            >
              <MaterialCommunityIcons color={colors.onPrimary} name="pencil" size={11} />
            </View>
          )}
        </View>

        <View className="flex-1" nativeID={`${idPrefix}-name-wrapper`} testID={`${idPrefix}-name-wrapper`}>
          <InputField dense error={form.errors.name} label="Nombre del equipo" onChange={form.setName} placeholder="Ej. Corredores del Sur" value={form.name} />
        </View>
      </View>

      <Row>
        <Col>
          {isWeb ? (
            <SelectField dense label="País" onChange={form.handleCountryChange} options={form.countryOptions} placeholder="Seleccioná un país" value={form.country} />
          ) : (
            <PickerField dense label="País" onChange={form.handleCountryChange} options={form.countryOptions} placeholder="Seleccioná un país" value={form.country} />
          )}
        </Col>
        <Col>
          {isWeb ? (
            <SelectField dense disabled={!form.country} label="Provincia" onChange={form.handleProvinceChange} options={form.provinceOptions} placeholder={form.country ? 'Seleccioná una provincia' : 'Elegí un país'} value={form.province} />
          ) : (
            <PickerField dense disabled={!form.country} label="Provincia" onChange={form.handleProvinceChange} options={form.provinceOptions} placeholder={form.country ? 'Seleccioná una provincia' : 'Elegí un país'} value={form.province} />
          )}
        </Col>
        <Col>
          {isWeb ? (
            <SelectField dense disabled={!form.province} label="Localidad" onChange={form.handleCityChange} options={form.cityOptions} placeholder={form.province ? 'Seleccioná una localidad' : 'Elegí una provincia'} value={form.city} />
          ) : (
            <PickerField dense disabled={!form.province} label="Localidad" onChange={form.handleCityChange} options={form.cityOptions} placeholder={form.province ? 'Seleccioná una localidad' : 'Elegí una provincia'} value={form.city} />
          )}
        </Col>
      </Row>

      <InputField dense label="Descripción del equipo" multiline numberOfLines={3} onChange={form.setDescription} placeholder="Contales a los corredores de qué se trata este equipo." value={form.description} />

      <Row>
        <Col>
          <PickerField dense error={form.errors.level} label="Nivel del equipo" onChange={form.setLevel} options={LEVEL_OPTIONS} placeholder="Elegir nivel" value={form.level} />
        </Col>
        <Col>
          <InputField dense error={form.errors.maxMembers} hint={`Tu plan permite hasta ${maxAllowed}.`} keyboardType="number-pad" label="Máx. de integrantes" onChange={form.setMaxMembers} placeholder={String(maxAllowed)} value={form.maxMembers} />
        </Col>
      </Row>

      <InputField dense label="Requerimientos de entrada al equipo" multiline numberOfLines={3} onChange={form.setRequirements} placeholder="Ej. Ritmo promedio, disponibilidad horaria, experiencia previa." value={form.requirements} />
    </>
  );
}

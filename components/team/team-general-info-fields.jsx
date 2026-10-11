import { Text } from 'react-native';
import { InputField, Row, Col, FIELD_LABEL } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { LocationPicker } from '../shared/location-picker';
import { formatArs } from '../../utils/currency.js';

export const LEVEL_OPTIONS = [
  { id: 'amateur', name: 'Amateur' },
  { id: 'semi-profesional', name: 'Semi-profesional' },
  { id: 'profesional', name: 'Profesional' },
];

// Campos de "datos generales" de un equipo — compartidos por
// CreateTeamScreen (paso 1 del wizard) y EditTeamScreen (pantalla única).
// `form` viene de hooks/use-team-general-info-form.js. `idPrefix` distingue
// los nativeID/testID de los wrappers propios de este bloque entre
// pantallas (nunca están montadas a la vez, pero mantiene los ids legibles
// para debug). Ya no incluye foto — se sube desde el detalle de equipo ya
// creado (ver components/team/team-detail-screen.jsx), no en este wizard.
export function TeamGeneralInfoFields({ form, maxAllowed, minimumFee, idPrefix, autoFocusName = false }) {
  // El mínimo lo define el tier del entrenador (GET /team-configuration). Se
  // muestra en el hint ANTES de guardar en vez de rechazar después — el
  // entrenador tiene que saber el piso mientras tipea, no al recibir el error.
  const feeHint = minimumFee
    ? `Dejalo vacío si el equipo es gratis. Mínimo ${formatArs(minimumFee)}. Para cobrar necesitás tu cuenta de Mercado Pago conectada.`
    : 'Dejalo vacío si el equipo es gratis. Para cobrar necesitás tu cuenta de Mercado Pago conectada.';
  return (
    <>
      <InputField autoFocus={autoFocusName} dense error={form.errors.name} label="Nombre del equipo" onChange={form.setName} placeholder="Ej. Corredores del Sur" value={form.name} />

      <Text className={FIELD_LABEL} nativeID="team-general-info-fields-location-label" testID="team-general-info-fields-location-label">Ubicación del equipo</Text>
      {form.isLegacyAddress && (
        <Text className="mb-1.5 text-xs text-slate-500 dark:text-slate-400" nativeID="team-general-info-fields-legacy-address-hint" testID="team-general-info-fields-legacy-address-hint">
          Dirección actual: {form.legacyAddressLabel}. Elegí un punto en el mapa para actualizarla con mayor precisión.
        </Text>
      )}
      <LocationPicker onChange={form.setLocationValue} value={form.locationValue} variant="card" />

      <InputField dense label="Descripción del equipo (opcional)" multiline numberOfLines={3} onChange={form.setDescription} placeholder="Contales a los corredores de qué se trata este equipo." value={form.description} />

      <Row>
        <Col>
          <ResponsiveSelectField dense error={form.errors.level} label="Nivel del equipo" onChange={form.setLevel} options={LEVEL_OPTIONS} placeholder="Elegir nivel" value={form.level} />
        </Col>
        <Col>
          <InputField dense error={form.errors.maxMembers} hint={`Tu plan permite hasta ${maxAllowed}.`} keyboardType="number-pad" label="Máx. de integrantes" onChange={form.setMaxMembers} placeholder={String(maxAllowed)} value={form.maxMembers} />
        </Col>
      </Row>

      <InputField
        dense
        error={form.errors.membershipFee}
        hint={feeHint}
        keyboardType="number-pad"
        label="Cuota mensual por corredor (opcional)"
        onChange={form.setMembershipFee}
        placeholder={minimumFee ? String(minimumFee) : 'Ej. 25000'}
        value={form.membershipFee}
      />

      <InputField dense label="Requerimientos de entrada al equipo" multiline numberOfLines={3} onChange={form.setRequirements} placeholder="Ej. Ritmo promedio, disponibilidad horaria, experiencia previa." value={form.requirements} />
    </>
  );
}

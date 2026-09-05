import { isWeb } from '../../utils/platform.js';
import { InputField, PickerField, Row, Col, SelectField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';

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
export function TeamGeneralInfoFields({ form, maxAllowed, idPrefix }) {
  return (
    <>
      <InputField dense error={form.errors.name} label="Nombre del equipo" onChange={form.setName} placeholder="Ej. Corredores del Sur" value={form.name} />

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
          <ResponsiveSelectField dense error={form.errors.level} label="Nivel del equipo" onChange={form.setLevel} options={LEVEL_OPTIONS} placeholder="Elegir nivel" value={form.level} />
        </Col>
        <Col>
          <InputField dense error={form.errors.maxMembers} hint={`Tu plan permite hasta ${maxAllowed}.`} keyboardType="number-pad" label="Máx. de integrantes" onChange={form.setMaxMembers} placeholder={String(maxAllowed)} value={form.maxMembers} />
        </Col>
      </Row>

      <InputField dense label="Requerimientos de entrada al equipo" multiline numberOfLines={3} onChange={form.setRequirements} placeholder="Ej. Ritmo promedio, disponibilidad horaria, experiencia previa." value={form.requirements} />
    </>
  );
}

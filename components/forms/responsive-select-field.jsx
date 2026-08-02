import { isWeb } from '../../utils/platform.js';
import { SelectField, PickerField } from './fields.jsx';

// SelectField (web, <select> nativo) y PickerField (mobile, modal) tienen
// exactamente la misma firma de props — este wrapper resuelve cuál usar
// según la plataforma, para no repetir el ternario en cada pantalla que
// necesita un select. Ver docs/superpowers/specs/2026-07-31-teams-invitations-and-stage2-fixes-design.md.
export function ResponsiveSelectField(props) {
  return isWeb ? <SelectField {...props} /> : <PickerField {...props} />;
}

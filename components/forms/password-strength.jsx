import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import {
  PASSWORD_REQUIREMENTS,
  getPasswordStrengthScore,
  getPasswordStrengthMeta,
} from '../../utils/password-validators.js';

// Barra de fuerza + checklist de requisitos de contraseña — compartido entre
// register-screen.jsx y reset-password-screen.jsx. Puramente presentacional,
// consume utils/password-validators.js. Extraído de register-screen.jsx (donde
// vivía local, sin exportar) con las mismas clases y lógica, ahora con
// nativeID/testID propios en vez de heredar el prefijo del screen que lo
// embebe.
export function StrengthBar({ password }) {
  const score = getPasswordStrengthScore(password);
  const total = PASSWORD_REQUIREMENTS.length;
  const pct = Math.round((score / total) * 100);
  const { label, color } = getPasswordStrengthMeta(score);

  return (
    <View className="mb-3 mt-2" nativeID="password-strength-bar" testID="password-strength-bar">
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" nativeID="password-strength-bar-track" testID="password-strength-bar-track">
        <View style={{ width: `${pct}%`, backgroundColor: color }} className="h-full rounded-full" nativeID="password-strength-bar-fill" testID="password-strength-bar-fill" />
      </View>
      {password.length > 0 && (
        <Text style={{ color }} className="mt-1 text-xs font-semibold" nativeID="password-strength-bar-label" testID="password-strength-bar-label">
          {label}
        </Text>
      )}
    </View>
  );
}

function RequirementRow({ id, met, label }) {
  const colors = useThemeColors();
  return (
    <View className="mb-1 flex-row items-center gap-2" nativeID={`password-strength-requirement-${id}`} testID={`password-strength-requirement-${id}`}>
      <MaterialCommunityIcons
        color={met ? '#8cc63e' : colors.onSurfaceVariant}
        name={met ? 'check-circle' : 'circle-outline'}
        size={14}
      />
      <Text className={`text-xs ${met ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`} nativeID={`password-strength-requirement-${id}-label`} testID={`password-strength-requirement-${id}-label`}>
        {label}
      </Text>
    </View>
  );
}

// `reqs` es el resultado de checkPasswordRequirements(password).
export function PasswordRequirementsList({ reqs }) {
  return (
    <View className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900" nativeID="password-strength-requirements-list" testID="password-strength-requirements-list">
      {PASSWORD_REQUIREMENTS.map((req) => (
        <RequirementRow key={req.id} id={req.id} label={req.label} met={reqs[req.id]} />
      ))}
    </View>
  );
}

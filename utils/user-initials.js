// Acepta un objeto {name, surname} (patrón de todo el resto del repo --
// shell/profile-screen) o directo un string de nombre completo (patrón de
// Gap 32: las filas de leaderboard solo traen `name` combinado, sin
// name/surname separados). Bug real 2026-10-15: leaderboard-tab.jsx le
// pasaba el string sin que el util lo soportara -- `"Lucía
// Fernández".name` es `undefined`, iniciales vacías, AvatarPicker caía al
// ícono default (sin `fallbackIcon` seteado ahí, círculo vacío).
export function getUserInitials(user) {
  if (typeof user === 'string') {
    const parts = user.trim().split(/\s+/).filter(Boolean);
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }
  return `${user?.name?.[0] ?? ''}${user?.surname?.[0] ?? ''}`.toUpperCase();
}

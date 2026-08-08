const DAY_MS = 24 * 60 * 60 * 1000;

// Antigüedad en el equipo (RunnerRow) y fecha de una invitación
// (InviteTeamMembersScreen) se muestran igual: "hace X" en vez de una fecha
// cruda — más legible de un vistazo, no hace falta el dato exacto en
// ninguno de los dos casos.
export function formatRelativeTime(dateIso) {
  const diffDays = Math.floor((Date.now() - new Date(dateIso).getTime()) / DAY_MS);

  if (diffDays < 1) return 'Hoy';
  if (diffDays === 1) return 'Hace 1 día';
  if (diffDays < 30) return `Hace ${diffDays} días`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return 'Hace 1 mes';
  if (diffMonths < 12) return `Hace ${diffMonths} meses`;

  const diffYears = Math.floor(diffMonths / 12);
  return diffYears === 1 ? 'Hace 1 año' : `Hace ${diffYears} años`;
}

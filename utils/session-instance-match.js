// Match por nombre (mejor esfuerzo) entre una SessionInstance ya congelada
// (sin referencia de vuelta al catálogo, ver
// docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md §3.1bis / Gap 7) y el catálogo
// actual del entrenador — permite preseleccionar el select de sesión al
// editar un día ya asignado, sin garantía de que sea "la misma" sesión si
// el catálogo cambió desde la asignación.
export function findMatchingCatalogSession(sessionInstance, sessions) {
  if (!sessionInstance) return null;
  return sessions.find((s) => s.name === sessionInstance.name) ?? null;
}

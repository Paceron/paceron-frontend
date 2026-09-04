// Catálogo de tiers — GET /api/v1/tiers?role_id= ya es un endpoint real
// del backend (no es parte de Fase 0/1/2 de pagos, existe desde antes).
// El filtro role_id es opcional, igual que en el backend real. Mismo
// patrón in-memory que el resto de los mocks del repo (teams-mock.js).
function buildSeedTiers() {
  const now = new Date().toISOString();
  return [
    {
      id: 1, name: 'base', description: 'Acceso a equipos, grupos e invitaciones — todo lo esencial de Paceron para arrancar a correr.',
      payment_required: false, role_id: 1, role_name: 'corredor', tier_amount: 0,
      created_at: now, updated_at: now,
    },
    {
      id: 2, name: 'premium', description: 'Estadísticas avanzadas de entrenamiento, prioridad en invitaciones y soporte directo con tu entrenador.',
      payment_required: true, role_id: 1, role_name: 'corredor', tier_amount: 4999,
      created_at: now, updated_at: now,
    },
    {
      id: 3, name: 'base', description: 'Gestión de un equipo, grupos ilimitados e invitaciones — todo lo esencial para arrancar a entrenar corredores.',
      payment_required: false, role_id: 2, role_name: 'entrenador', tier_amount: 0,
      created_at: now, updated_at: now,
    },
    {
      id: 4, name: 'premium', description: 'Más de un equipo, límite de corredores ampliado y planes de entrenamiento sin restricciones.',
      payment_required: true, role_id: 2, role_name: 'entrenador', tier_amount: 9999,
      created_at: now, updated_at: now,
    },
  ];
}

const mockTiers = buildSeedTiers();

export async function mockListTiers({ roleId } = {}) {
  if (roleId == null) return [...mockTiers];
  return mockTiers.filter((tier) => tier.role_id === Number(roleId));
}

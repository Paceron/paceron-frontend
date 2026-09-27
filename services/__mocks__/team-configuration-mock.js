// Simula GET /team-configuration para EXPO_PUBLIC_USE_MOCKS=true.
// Valores del hashmap tier → configuración del backend
// (cmd/api/domains/teamconfiguration/team_configuration.go): hoy el mínimo de
// cuota es 20000 para los tres tiers, y max_members varía 10/25/50. Se devuelve
// el default (tier `base`) porque el mock no modela el tier del entrenador.
const MOCK_TEAM_CONFIGURATION = { max_members: 10, minimum_fee: 20000 };

export async function mockGetTeamConfiguration() {
  return { ...MOCK_TEAM_CONFIGURATION };
}

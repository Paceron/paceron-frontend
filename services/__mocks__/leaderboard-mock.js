// Fixture visual para EXPO_PUBLIC_USE_MOCKS=true (Gap 32). Exactamente 5
// filas (ya es el "top 5" que manda el backend) + un `viewer_rank` en el
// puesto 7 (fuera del top 5, para poder ver la fila propia renderizada
// aparte) + un `record` fijo para el modo histórico. Ignora los params de
// metric/period a propósito -- es un fixture visual, no un simulador real
// de agregación.
const MOCK_ROWS = [
  { user_id: 1, name: 'Lucía Fernández', avatar_url: null, value: 42500, rank: 1 },
  { user_id: 2, name: 'Martín Gómez', avatar_url: null, value: 38200, rank: 2 },
  { user_id: 3, name: 'Sofía Ibarra', avatar_url: null, value: 35900, rank: 3 },
  { user_id: 4, name: 'Tomás Silva', avatar_url: null, value: 31000, rank: 4 },
  { user_id: 5, name: 'Valentina Ríos', avatar_url: null, value: 28700, rank: 5 },
];

const MOCK_VIEWER_RANK = { user_id: 42, value: 15400, rank: 7 };

const MOCK_RECORD = { user_id: 1, name: 'Lucía Fernández', value: 58300, achieved_at: '2026-06-12' };

export async function mockGetTeamLeaderboard() {
  return { rows: MOCK_ROWS, viewer_rank: MOCK_VIEWER_RANK, record: MOCK_RECORD };
}

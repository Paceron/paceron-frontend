// Fixture visual para EXPO_PUBLIC_USE_MOCKS=true -- sin backend real todavía
// (Gap 30). Patrón determinístico que se repite cada 7 días: deja ver los 4
// estados (completed/failed/skipped/pending) en la grilla sin levantar
// backend. `has_unseen: true` a propósito, para poder probar el flujo de
// "marcar como visto" (Gap 34) sin esperar a que una racha real se rompa.
const PATTERN = ['completed', 'completed', 'failed', 'completed', 'skipped', 'completed', 'completed'];

function buildMockDays(days) {
  const today = new Date();
  const result = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const iso = date.toISOString().slice(0, 10);
    const status = i === 0 ? 'pending' : PATTERN[i % PATTERN.length];
    result.push({
      date: iso,
      strict_status: status,
      flexible_status: status === 'failed' ? 'completed' : status,
    });
  }
  return result;
}

export async function mockGetStreaks(days = 42) {
  return {
    strict: { current: 6, best: 14 },
    flexible: { current: 9, best: 20 },
    days: buildMockDays(days),
    has_unseen: true,
  };
}

#!/usr/bin/env node
// Crea en el backend real dos competencias de ruta (con mapa) para el team 29:
//   - una pendiente de aprobación (la propone un corredor)
//   - una finalizada (la crea el entrenador y se cierra)
//
// Uso:
//   PACERON_TOKEN=<jwt-entrenador> node scripts/seed-team-29-competitions.mjs
//   PACERON_EMAIL=... PACERON_PASSWORD=... node scripts/seed-team-29-competitions.mjs
//
// Para la pendiente hace falta un token/credenciales de un CORREDOR del team:
//   PACERON_RUNNER_TOKEN=<jwt-corredor>
//   o PACERON_RUNNER_EMAIL=... PACERON_RUNNER_PASSWORD=...
//
// Opcionales: PACERON_API_URL (default Render develop), PACERON_TEAM_ID (default 29).

const API_URL = (process.env.PACERON_API_URL || 'https://paceron-backend-as9c.onrender.com/api/v1').replace(/\/$/, '');
const TEAM_ID = Number(process.env.PACERON_TEAM_ID || 29);

const PENDING_ROUTE = {
  type: 'LineString',
  coordinates: [
    [-58.3816, -34.6037],
    [-58.3800, -34.6045],
    [-58.3786, -34.6051],
    [-58.3772, -34.6058],
  ],
};
const FINISHED_ROUTE = {
  type: 'LineString',
  coordinates: [
    [-58.4200, -34.5900],
    [-58.4180, -34.5910],
    [-58.4160, -34.5920],
    [-58.4140, -34.5930],
  ],
};

function requireEnvAny(names) {
  for (const name of names) if (process.env[name]) return process.env[name];
  return null;
}

async function request(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function resolveToken({ tokenEnv, emailEnv, passwordEnv, label }) {
  const direct = process.env[tokenEnv];
  if (direct) return direct;
  const email = process.env[emailEnv];
  const password = process.env[passwordEnv];
  if (!email || !password) return null;
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  const token = login?.access_token ?? login?.data?.access_token;
  if (!token) throw new Error(`Login de ${label} no devolvió access_token: ${JSON.stringify(login)}`);
  return token;
}

function toIsoDate(offsetDays) {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString();
}

async function listTeamCompetitions(token) {
  const res = await request(`/teams/${TEAM_ID}/competitions`, { token });
  return Array.isArray(res) ? res : (res?.data ?? []);
}

async function listParticipants(token) {
  const res = await request(`/teams/${TEAM_ID}/users`, { token });
  const rows = Array.isArray(res) ? res : (res?.data ?? []);
  const runners = rows
    .filter((r) => (r.role_in_team ?? '').toLowerCase() === 'corredor')
    .map((r) => Number(r.user_id))
    .filter((id) => Number.isFinite(id));
  const all = rows.map((r) => Number(r.user_id)).filter((id) => Number.isFinite(id));
  const picked = [...new Set(runners.length >= 2 ? runners : all)].slice(0, 8);
  if (picked.length < 2) throw new Error(`El team ${TEAM_ID} no tiene al menos 2 miembros para competir`);
  return picked;
}

function createPayload({ startAt, route, maxAttempts, participants }) {
  return {
    type: 'route',
    start_at: startAt,
    route_geojson: JSON.stringify(route),
    acceptance_radius_meters: 50,
    max_attempts: maxAttempts,
    participants,
  };
}

async function createRouteCompetition({ token, startAt, route, maxAttempts, participants, label }) {
  const created = await request(`/teams/${TEAM_ID}/competitions`, {
    method: 'POST',
    token,
    body: createPayload({ startAt, route, maxAttempts, participants }),
  });
  const competition = created?.data ?? created;
  console.log(`✅ ${label}: id=${competition.id} status=${competition.status}`);
  return competition;
}

async function main() {
  const trainerToken = await resolveToken({
    tokenEnv: 'PACERON_TOKEN',
    emailEnv: 'PACERON_EMAIL',
    passwordEnv: 'PACERON_PASSWORD',
    label: 'entrenador',
  });
  if (!trainerToken) {
    console.error('Falta autenticación. Definí PACERON_TOKEN o PACERON_EMAIL + PACERON_PASSWORD.');
    process.exitCode = 1;
    return;
  }

  const runnerToken = await resolveToken({
    tokenEnv: 'PACERON_RUNNER_TOKEN',
    emailEnv: 'PACERON_RUNNER_EMAIL',
    passwordEnv: 'PACERON_RUNNER_PASSWORD',
    label: 'corredor',
  });

  const participants = await listParticipants(trainerToken);
  console.log(`Team ${TEAM_ID} — participantes: ${participants.join(', ')}`);

  const existing = await listTeamCompetitions(trainerToken);
  const startPending = toIsoDate(1);
  const startFinished = toIsoDate(-15);

  const already = (status, startAt) => existing.some((c) => {
    const sameDay = String(c.start_at ?? '').slice(0, 10) === String(startAt).slice(0, 10);
    return c.type === 'route' && c.status === status && sameDay;
  });

  // Finalizada: la crea el entrenador (queda active) y se cierra.
  if (already('finished', startFinished)) {
    console.log('ℹ️ Ya existe una competencia de ruta finalizada para esa fecha; se omite.');
  } else {
    const finished = await createRouteCompetition({
      token: trainerToken,
      startAt: startFinished,
      route: FINISHED_ROUTE,
      maxAttempts: 1,
      participants,
      label: 'Competencia finalizada (creada)',
    });
    if (finished.status === 'active') {
      await request(`/competitions/${finished.id}/close`, { method: 'PATCH', token: trainerToken });
      console.log(`✅ Competencia finalizada: id=${finished.id} cerrada (finished).`);
    }
  }

  // Pendiente: la tiene que proponer un corredor del team.
  if (already('pending_approval', startPending)) {
    console.log('ℹ️ Ya existe una competencia de ruta pendiente para esa fecha; se omite.');
  } else if (!runnerToken) {
    console.warn('⚠️ No se creó la pendiente: falta PACERON_RUNNER_TOKEN (o credenciales del corredor).');
  } else {
    await createRouteCompetition({
      token: runnerToken,
      startAt: startPending,
      route: PENDING_ROUTE,
      maxAttempts: 2,
      participants,
      label: 'Competencia pendiente',
    });
  }

  const finalList = await listTeamCompetitions(trainerToken);
  const routes = finalList.filter((c) => c.type === 'route');
  console.log('\nCompetencias de ruta del team:');
  for (const c of routes) {
    console.log(`- id=${c.id} status=${c.status} start_at=${c.start_at} route=${c.route ? 'sí' : 'no'}`);
  }
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exitCode = 1;
});

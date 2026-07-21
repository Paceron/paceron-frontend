import { create } from 'zustand';

// Sin backend de equipos todavia (ver docs/BACKEND_DEFINITIONS.md) — mock
// en memoria, mismo criterio que roles/activeRole en auth-store hasta que
// exista el endpoint real.
const MOCK_TEAMS = [
  { id: 'team-1', name: 'Corredores del Sur' },
  { id: 'team-2', name: 'Running Cordoba Norte' },
  { id: 'team-3', name: 'Maraton Runners' },
];

export const useTeamStore = create((set) => ({
  teams: MOCK_TEAMS,
  selectedTeamId: null,

  selectTeam: (teamId) => set({ selectedTeamId: teamId }),
}));

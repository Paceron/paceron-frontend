import { upcomingTrainingsRange, selectUpcomingTrainings } from '../utils/upcoming-trainings.js';

describe('upcomingTrainingsRange', () => {
  it('returns from=today and to=today+90 days', () => {
    const now = new Date(2026, 8, 25); // 2026-09-25
    expect(upcomingTrainingsRange(now)).toEqual({ from: '2026-09-25', to: '2026-12-24' });
  });

  it('rolls over year correctly', () => {
    const now = new Date(2026, 11, 25); // 2026-12-25
    expect(upcomingTrainingsRange(now)).toEqual({ from: '2026-12-25', to: '2027-03-25' });
  });
});

describe('selectUpcomingTrainings', () => {
  const now = new Date(2026, 8, 25); // 2026-09-25

  it('excludes rest, other and cancelled kinds', () => {
    const days = [
      { id: '1', date: '2026-09-26', kind: 'training' },
      { id: '2', date: '2026-09-27', kind: 'rest' },
      { id: '3', date: '2026-09-28', kind: 'other' },
      { id: '4', date: '2026-09-29', kind: 'cancelled' },
    ];
    expect(selectUpcomingTrainings(days, now).map((d) => d.id)).toEqual(['1']);
  });

  it('excludes past days and includes today', () => {
    const days = [
      { id: '1', date: '2026-09-24', kind: 'training' },
      { id: '2', date: '2026-09-25', kind: 'training' },
      { id: '3', date: '2026-09-26', kind: 'training' },
    ];
    expect(selectUpcomingTrainings(days, now).map((d) => d.id)).toEqual(['2', '3']);
  });

  it('sorts ascending by date', () => {
    const days = [
      { id: '1', date: '2026-10-05', kind: 'training' },
      { id: '2', date: '2026-09-26', kind: 'training' },
      { id: '3', date: '2026-09-30', kind: 'training' },
    ];
    expect(selectUpcomingTrainings(days, now).map((d) => d.id)).toEqual(['2', '3', '1']);
  });
});

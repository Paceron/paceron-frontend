import {
  selectCancelledBefore,
  selectNextPendingTraining,
  selectNextPendingTrainings,
  selectNextTraining,
} from '../utils/next-training-banner.js';

describe('selectNextTraining', () => {
  const now = new Date(2026, 8, 25); // 2026-09-25

  it('picks the earliest future training', () => {
    const days = [
      { id: '1', date: '2026-10-05', kind: 'training', isPresencial: false },
      { id: '2', date: '2026-09-26', kind: 'training', isPresencial: false },
      { id: '3', date: '2026-09-24', kind: 'training', isPresencial: false },
    ];
    expect(selectNextTraining(days, {}, now)?.id).toBe('2');
  });

  it('excludes rest, other and cancelled kinds', () => {
    const days = [
      { id: '1', date: '2026-09-26', kind: 'rest' },
      { id: '2', date: '2026-09-27', kind: 'other' },
      { id: '3', date: '2026-09-28', kind: 'cancelled' },
    ];
    expect(selectNextTraining(days, {}, now)).toBeNull();
  });

  it('filters by presencialOnly when set', () => {
    const days = [
      { id: '1', date: '2026-09-26', kind: 'training', isPresencial: false },
      { id: '2', date: '2026-09-27', kind: 'training', isPresencial: true },
    ];
    expect(selectNextTraining(days, { presencialOnly: true }, now)?.id).toBe('2');
  });

  it('does not filter by presencial when presencialOnly is false', () => {
    const days = [{ id: '1', date: '2026-09-26', kind: 'training', isPresencial: false }];
    expect(selectNextTraining(days, { presencialOnly: false }, now)?.id).toBe('1');
  });

  it('returns null when no candidates', () => {
    expect(selectNextTraining([], {}, now)).toBeNull();
  });

  it('excludes a presencial training today whose presencial_time_to already passed', () => {
    const nowEvening = new Date(2026, 8, 25, 20, 0); // Fri 2026-09-25, 20:00
    const days = [
      { id: '1', date: '2026-09-25', kind: 'training', isPresencial: true, presencialTimeFrom: '12:00', presencialTimeTo: '14:00' },
      { id: '2', date: '2026-09-27', kind: 'training', isPresencial: true, presencialTimeFrom: '10:00', presencialTimeTo: '11:00' },
    ];
    expect(selectNextTraining(days, {}, nowEvening)?.id).toBe('2');
  });

  it('includes a presencial training today whose presencial_time_to has not passed yet', () => {
    const nowMorning = new Date(2026, 8, 25, 10, 0);
    const days = [{ id: '1', date: '2026-09-25', kind: 'training', isPresencial: true, presencialTimeFrom: '12:00', presencialTimeTo: '14:00' }];
    expect(selectNextTraining(days, {}, nowMorning)?.id).toBe('1');
  });

  it('does not time-gate a non-presencial training today', () => {
    const nowNight = new Date(2026, 8, 25, 23, 0);
    const days = [{ id: '1', date: '2026-09-25', kind: 'training', isPresencial: false }];
    expect(selectNextTraining(days, {}, nowNight)?.id).toBe('1');
  });
});

describe('selectNextPendingTraining', () => {
  const now = new Date(2026, 8, 25); // 2026-09-25

  it('skips trainings already finished or interrupted', () => {
    const days = [
      { id: '1', date: '2026-09-25', kind: 'training', sessionInstance: { id: 101 } },
      { id: '2', date: '2026-09-26', kind: 'training', sessionInstance: { id: '102' } },
      { id: '3', date: '2026-09-27', kind: 'training', sessionInstance: { id: 103 } },
    ];
    const statusBySessionId = { 101: 'finished', 102: 'interrupted' };
    expect(selectNextPendingTraining(days, statusBySessionId, {}, now)?.id).toBe('3');
  });

  it('keeps trainings without runner status and with pending status', () => {
    const days = [
      { id: '1', date: '2026-09-25', kind: 'training', sessionInstance: { id: 101 } },
      { id: '2', date: '2026-09-26', kind: 'training', sessionInstance: { id: 102 } },
    ];
    expect(selectNextPendingTraining(days, { 102: 'wip' }, {}, now)?.id).toBe('1');
  });

  it('returns all pending trainings on the earliest date and excludes later dates', () => {
    const days = [
      { id: 'later', date: '2026-09-26', kind: 'training', sessionInstance: { id: 104 } },
      { id: 'first-b', date: '2026-09-25', kind: 'training', sessionInstance: { id: 102 } },
      { id: 'first-a', date: '2026-09-25', kind: 'training', sessionInstance: { id: 101 } },
    ];

    expect(selectNextPendingTrainings(days, {}, {}, now).map((day) => day.id)).toEqual(['first-b', 'first-a']);
  });

  it('keeps other sessions from the same date when one is already finished', () => {
    const days = [
      { id: 'finished', date: '2026-09-25', kind: 'training', sessionInstance: { id: 101 } },
      { id: 'pending-today', date: '2026-09-25', kind: 'training', sessionInstance: { id: 102 } },
      { id: 'tomorrow', date: '2026-09-26', kind: 'training', sessionInstance: { id: 103 } },
    ];

    expect(selectNextPendingTrainings(days, { 101: 'finished' }, {}, now).map((day) => day.id)).toEqual(['pending-today']);
  });

  it('moves to the next date when every session on the nearest date is closed', () => {
    const days = [
      { id: 'finished', date: '2026-09-25', kind: 'training', sessionInstance: { id: 101 } },
      { id: 'interrupted', date: '2026-09-25', kind: 'training', sessionInstance: { id: 102 } },
      { id: 'tomorrow', date: '2026-09-26', kind: 'training', sessionInstance: { id: 103 } },
    ];

    expect(selectNextPendingTrainings(days, { 101: 'finished', 102: 'interrupted' }, {}, now).map((day) => day.id)).toEqual(['tomorrow']);
  });

  it('returns null when every candidate is already closed', () => {
    const days = [
      { id: '1', date: '2026-09-25', kind: 'training', sessionInstance: { id: 101 } },
      { id: '2', date: '2026-09-26', kind: 'training', sessionInstance: { id: 102 } },
    ];
    expect(selectNextPendingTraining(days, { 101: 'finished', 102: 'interrupted' }, {}, now)).toBeNull();
  });

  it('respects presencialOnly and the presencial end time', () => {
    const nowEvening = new Date(2026, 8, 25, 20, 0);
    const days = [
      { id: '1', date: '2026-09-25', kind: 'training', isPresencial: true, presencialTimeFrom: '12:00', presencialTimeTo: '14:00' },
      { id: '2', date: '2026-09-26', kind: 'training', isPresencial: false },
      { id: '3', date: '2026-09-27', kind: 'training', isPresencial: true, presencialTimeFrom: '10:00', presencialTimeTo: '11:00' },
    ];
    expect(selectNextPendingTraining(days, {}, { presencialOnly: true }, nowEvening)?.id).toBe('3');
  });
});

describe('selectCancelledBefore', () => {
  const now = new Date(2026, 8, 25); // 2026-09-25

  it('includes only cancelled days within [today, beforeDate)', () => {
    const days = [
      { id: '1', date: '2026-09-24', kind: 'cancelled' }, // past, excluded
      { id: '2', date: '2026-09-26', kind: 'cancelled' }, // included
      { id: '3', date: '2026-09-30', kind: 'cancelled' }, // == beforeDate boundary excluded below
      { id: '4', date: '2026-09-28', kind: 'training' }, // wrong kind, excluded
    ];
    expect(selectCancelledBefore(days, '2026-09-30', now).map((d) => d.id)).toEqual(['2']);
  });

  it('sorts ascending', () => {
    const days = [
      { id: '1', date: '2026-09-29', kind: 'cancelled' },
      { id: '2', date: '2026-09-26', kind: 'cancelled' },
    ];
    expect(selectCancelledBefore(days, '2026-10-01', now).map((d) => d.id)).toEqual(['2', '1']);
  });

  it('returns empty array when none match', () => {
    expect(selectCancelledBefore([], '2026-10-01', now)).toEqual([]);
  });
});

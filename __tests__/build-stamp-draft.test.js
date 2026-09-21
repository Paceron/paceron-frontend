import { addDaysISO, buildStampDraft, findClosedDraftDates } from '../utils/build-stamp-draft.js';

const PLAN = {
  days: [
    { sequenceNo: 1, kind: 'training', otherName: null, sessionId: '9', isPresencial: true, presencialTimeFrom: '08:00', presencialTimeTo: '09:30', presencialLocation: { lat: -34.6, lng: -58.4, label: 'Plaza' } },
    { sequenceNo: 2, kind: 'rest', otherName: null, sessionId: null, isPresencial: false, presencialTimeFrom: null, presencialTimeTo: null, presencialLocation: null },
    { sequenceNo: 3, kind: 'other', otherName: 'Elongación', sessionId: null, isPresencial: false, presencialTimeFrom: null, presencialTimeTo: null, presencialLocation: null },
  ],
};

describe('addDaysISO', () => {
  test('suma días dentro del mismo mes', () => {
    expect(addDaysISO('2026-03-10', 3)).toBe('2026-03-13');
  });

  test('cruza de mes correctamente', () => {
    expect(addDaysISO('2026-01-30', 2)).toBe('2026-02-01');
  });

  test('cruza de año correctamente (fin de diciembre)', () => {
    expect(addDaysISO('2026-12-30', 2)).toBe('2027-01-01');
  });

  test('con 0 días devuelve la misma fecha', () => {
    expect(addDaysISO('2026-03-10', 0)).toBe('2026-03-10');
  });
});

describe('buildStampDraft', () => {
  test('arma un draftDay por día del plan, con fecha calculada desde sequenceNo', () => {
    const draft = buildStampDraft(PLAN, '2026-03-10');
    expect(draft).toHaveLength(3);
    expect(draft.map((d) => d.date)).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
  });

  test('copia kind/otherName/sessionId/presencial+horario+ubicación del PlanDay', () => {
    const [first] = buildStampDraft(PLAN, '2026-03-10');
    expect(first).toEqual({
      date: '2026-03-10',
      sequenceNo: 1,
      kind: 'training',
      otherName: null,
      sessionId: '9',
      isPresencial: true,
      presencialTimeFrom: '08:00',
      presencialTimeTo: '09:30',
      presencialLocation: { lat: -34.6, lng: -58.4, label: 'Plaza' },
      touched: false,
    });
  });

  test('un día no presencial arranca con presencialLocation null, y touched siempre arranca false', () => {
    const draft = buildStampDraft(PLAN, '2026-03-10');
    expect(draft[1].presencialLocation).toBeNull();
    expect(draft.every((d) => d.touched === false)).toBe(true);
  });

  test('un plan que empieza cerca de fin de mes calcula bien el cruce', () => {
    const draft = buildStampDraft(PLAN, '2026-01-30');
    expect(draft.map((d) => d.date)).toEqual(['2026-01-30', '2026-01-31', '2026-02-01']);
  });
});

describe('findClosedDraftDates', () => {
  const NOW = new Date(2026, 2, 15, 10, 0, 0); // 2026-03-15 10:00, hora local

  test('fechas pasadas están cerradas', () => {
    const draft = buildStampDraft(PLAN, '2026-03-10');
    expect(findClosedDraftDates(draft, NOW)).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
  });

  test('fechas futuras no están cerradas', () => {
    const draft = buildStampDraft(PLAN, '2026-04-01');
    expect(findClosedDraftDates(draft, NOW)).toEqual([]);
  });

  test('un día de HOY presencial con horario aún no arrancado no está cerrado', () => {
    const draft = [{ date: '2026-03-15', sequenceNo: 1, kind: 'training', otherName: null, sessionId: '9', isPresencial: true, presencialTimeFrom: '18:00', presencialTimeTo: '19:00', presencialLocation: null, touched: false }];
    expect(findClosedDraftDates(draft, NOW)).toEqual([]);
  });

  test('un día de HOY presencial con horario ya arrancado está cerrado', () => {
    const draft = [{ date: '2026-03-15', sequenceNo: 1, kind: 'training', otherName: null, sessionId: '9', isPresencial: true, presencialTimeFrom: '08:00', presencialTimeTo: '09:00', presencialLocation: null, touched: false }];
    expect(findClosedDraftDates(draft, NOW)).toEqual(['2026-03-15']);
  });

  test('un día de HOY no presencial siempre está cerrado', () => {
    const draft = [{ date: '2026-03-15', sequenceNo: 1, kind: 'rest', otherName: null, sessionId: null, isPresencial: false, presencialTimeFrom: null, presencialTimeTo: null, presencialLocation: null, touched: false }];
    expect(findClosedDraftDates(draft, NOW)).toEqual(['2026-03-15']);
  });
});

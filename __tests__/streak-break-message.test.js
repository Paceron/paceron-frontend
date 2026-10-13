import { buildStreakBrokenMessage } from '../utils/streak-break-message.js';

const streaksWithFailedDay = {
  strict: { current: 0, best: 10 },
  flexible: { current: 0, best: 12 },
  days: [
    { date: '2026-10-10', strictStatus: 'completed', flexibleStatus: 'completed' },
    { date: '2026-10-11', strictStatus: 'failed', flexibleStatus: 'completed' },
    { date: '2026-10-12', strictStatus: 'skipped', flexibleStatus: 'failed' },
  ],
};

const streaksWithoutFailedDay = {
  strict: { current: 0, best: 10 },
  flexible: { current: 0, best: 12 },
  days: [
    { date: '2026-10-11', strictStatus: 'skipped', flexibleStatus: 'completed' },
    { date: '2026-10-12', strictStatus: 'skipped', flexibleStatus: 'completed' },
  ],
};

const streaksStillGoing = {
  strict: { current: 3, best: 10 },
  flexible: { current: 5, best: 12 },
  days: [{ date: '2026-10-12', strictStatus: 'completed', flexibleStatus: 'completed' }],
};

describe('buildStreakBrokenMessage', () => {
  test('sin racha previa (null) -> no hay mensaje', () => {
    expect(buildStreakBrokenMessage(null, streaksWithFailedDay)).toBeNull();
  });

  test('racha previa ya era 0 -> no hay mensaje (no se "rompió" de nuevo)', () => {
    expect(buildStreakBrokenMessage(0, streaksWithFailedDay)).toBeNull();
  });

  test('racha previa > 0, racha actual sigue > 0 -> no hay mensaje', () => {
    expect(buildStreakBrokenMessage(2, streaksStillGoing)).toBeNull();
  });

  test('racha previa > 0, racha actual 0, con día failed -> mensaje con fecha', () => {
    const msg = buildStreakBrokenMessage(5, streaksWithFailedDay);
    expect(msg.text1).toBe('Racha reiniciada');
    expect(msg.text2).toBe('Tu racha de entrenamientos consecutivos se reinició el 11-10-2026. ¡A por una nueva!');
  });

  test('racha previa > 0, racha actual 0, sin día failed en la ventana -> mensaje genérico', () => {
    const msg = buildStreakBrokenMessage(5, streaksWithoutFailedDay);
    expect(msg.text2).toBe('Tu racha de entrenamientos consecutivos se reinició. ¡A por una nueva!');
  });
});

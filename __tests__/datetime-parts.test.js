import { composeDateTime, deriveDurationMs, formatDMY, formatHm, mirrorEndIfEmpty, splitDateTime } from '../utils/datetime-parts.js';

describe('splitDateTime', () => {
  test('parte un ISO en los dos formatos de los campos (DD/MM/AAAA + HH:mm)', () => {
    // 2026-09-24T18:30 local → 24/09/2026 + 18:30
    const local = new Date(2026, 8, 24, 18, 30, 0, 0);
    expect(splitDateTime(local.toISOString())).toEqual({ date: '24/09/2026', time: '18:30' });
  });

  test('sin valor → ambos vacíos', () => {
    expect(splitDateTime(null)).toEqual({ date: '', time: '' });
    expect(splitDateTime(undefined)).toEqual({ date: '', time: '' });
    expect(splitDateTime('')).toEqual({ date: '', time: '' });
  });

  test('iso inválido → ambos vacíos (no rompe la precarga)', () => {
    expect(splitDateTime('no-es-fecha')).toEqual({ date: '', time: '' });
  });
});

describe('formatDMY / formatHm', () => {
  test('pad de dos dígitos', () => {
    const d = new Date(2026, 0, 5, 7, 4, 0, 0);
    expect(formatDMY(d)).toBe('05/01/2026');
    expect(formatHm(d)).toBe('07:04');
  });
});

describe('composeDateTime', () => {
  test('DD/MM/AAAA + HH:mm → Date local', () => {
    const composed = composeDateTime('24/09/2026', '18:30');
    expect(composed.getFullYear()).toBe(2026);
    expect(composed.getMonth()).toBe(8);
    expect(composed.getDate()).toBe(24);
    expect(composed.getHours()).toBe(18);
    expect(composed.getMinutes()).toBe(30);
  });

  test('hora vacía → medianoche (elegir solo la fecha es válido)', () => {
    const composed = composeDateTime('24/09/2026', '');
    expect(composed.getHours()).toBe(0);
    expect(composed.getMinutes()).toBe(0);
  });

  test('hora de un dígito se acepta (9:05)', () => {
    const composed = composeDateTime('24/09/2026', '9:05');
    expect(composed.getHours()).toBe(9);
    expect(composed.getMinutes()).toBe(5);
  });

  test('fecha mal formada → null', () => {
    expect(composeDateTime('2026-09-24', '18:30')).toBeNull();
    expect(composeDateTime('24-09-2026', '18:30')).toBeNull();
    expect(composeDateTime('', '18:30')).toBeNull();
    expect(composeDateTime(null, '18:30')).toBeNull();
  });

  test('mes/día fuera de rango → null', () => {
    expect(composeDateTime('24/13/2026', '10:00')).toBeNull();
    expect(composeDateTime('32/09/2026', '10:00')).toBeNull();
  });

  test('hora fuera de rango → null (no guarda fecha corrupta)', () => {
    expect(composeDateTime('24/09/2026', '25:00')).toBeNull();
    expect(composeDateTime('24/09/2026', '10:75')).toBeNull();
  });

  test('hora mal formada → null', () => {
    expect(composeDateTime('24/09/2026', 'abc')).toBeNull();
  });
});

describe('mirrorEndIfEmpty (auto-completado direccional inicio → fin)', () => {
  test('toco inicio con fin vacío → copia el valor al fin', () => {
    expect(mirrorEndIfEmpty({ startChanged: true, nextStartValue: '24/09/2026', currentEndValue: '' })).toBe('24/09/2026');
  });

  test('fin vacío como null también cuenta como vacío', () => {
    expect(mirrorEndIfEmpty({ startChanged: true, nextStartValue: '10:00', currentEndValue: null })).toBe('10:00');
  });

  test('toco inicio con fin YA cargado → no hace nada (no pisa lo elegido a mano)', () => {
    expect(mirrorEndIfEmpty({ startChanged: true, nextStartValue: '24/09/2026', currentEndValue: '25/09/2026' })).toBeNull();
  });

  test('toco el FIN (startChanged false) → nunca modifica el inicio', () => {
    // El helper solo espeja en la dirección inicio→fin; el caller del fin
    // directamente NO lo invoca, así que editar el fin no toca el inicio.
    expect(mirrorEndIfEmpty({ startChanged: false, nextStartValue: 'cualquiera', currentEndValue: '' })).toBeNull();
  });

  test('fin con espacios en blanco cuenta como vacío', () => {
    expect(mirrorEndIfEmpty({ startChanged: true, nextStartValue: '07:00', currentEndValue: '   ' })).toBe('07:00');
  });
});

describe('deriveDurationMs', () => {
  test('campo vacío + fecha y hora en ambos extremos → duración por diferencia', () => {
    expect(deriveDurationMs({
      durationText: '',
      startedDate: '24/09/2026', startedTime: '18:00',
      endedDate: '24/09/2026', endedTime: '18:03',
    })).toBe(180000);
  });

  test('cruza la medianoche', () => {
    expect(deriveDurationMs({
      durationText: '',
      startedDate: '24/09/2026', startedTime: '23:50',
      endedDate: '25/09/2026', endedTime: '00:10',
    })).toBe(20 * 60000);
  });

  test('si el campo TIENE texto → no calcula (el valor del usuario manda)', () => {
    expect(deriveDurationMs({
      durationText: '9:99',
      startedDate: '24/09/2026', startedTime: '18:00',
      endedDate: '24/09/2026', endedTime: '18:03',
    })).toBeNull();
  });

  test('campo con espacios cuenta como vacío (se completa)', () => {
    expect(deriveDurationMs({
      durationText: '   ',
      startedDate: '24/09/2026', startedTime: '18:00',
      endedDate: '24/09/2026', endedTime: '18:01',
    })).toBe(60000);
  });

  test('falta la hora de fin → null (no asumir medianoche: daría 18h)', () => {
    expect(deriveDurationMs({
      durationText: '',
      startedDate: '24/09/2026', startedTime: '18:00',
      endedDate: '25/09/2026', endedTime: '',
    })).toBeNull();
  });

  test('falta la hora de inicio → null', () => {
    expect(deriveDurationMs({
      durationText: '',
      startedDate: '24/09/2026', startedTime: '',
      endedDate: '25/09/2026', endedTime: '10:00',
    })).toBeNull();
  });

  test('fin anterior al inicio → null', () => {
    expect(deriveDurationMs({
      durationText: '',
      startedDate: '24/09/2026', startedTime: '18:00',
      endedDate: '24/09/2026', endedTime: '17:00',
    })).toBeNull();
  });

  test('fin igual al inicio → null (duración 0 no se autocompleta)', () => {
    expect(deriveDurationMs({
      durationText: '',
      startedDate: '24/09/2026', startedTime: '18:00',
      endedDate: '24/09/2026', endedTime: '18:00',
    })).toBeNull();
  });

  test('fechas sin cargar → null', () => {
    expect(deriveDurationMs({ durationText: '', startedDate: '', startedTime: '', endedDate: '', endedTime: '' })).toBeNull();
  });
});

import { applyPeerPresence } from '../utils/connected-peers.js';

describe('applyPeerPresence', () => {
  test('joined agrega el userId', () => {
    const next = applyPeerPresence(new Set(), { type: 'presence', event: 'joined', from: 12 });
    expect(next.has('12')).toBe(true);
  });

  test('left lo quita', () => {
    const next = applyPeerPresence(new Set(['12']), { type: 'presence', event: 'left', from: 12 });
    expect(next.has('12')).toBe(false);
  });

  test('position también prueba conexión aunque nunca llegó joined', () => {
    const next = applyPeerPresence(new Set(), { type: 'presence', event: 'position', from: 7, payload: {} });
    expect(next.has('7')).toBe(true);
  });

  test('set_status también prueba conexión', () => {
    const next = applyPeerPresence(new Set(), { type: 'presence', event: 'set_status', from: 7, payload: {} });
    expect(next.has('7')).toBe(true);
  });

  test('mensaje que no es presence no cambia nada (misma referencia)', () => {
    const current = new Set(['12']);
    expect(applyPeerPresence(current, { type: 'control', event: 'session_paused' })).toBe(current);
  });

  test('left de alguien que no estaba devuelve la misma referencia', () => {
    const current = new Set();
    expect(applyPeerPresence(current, { type: 'presence', event: 'left', from: 9 })).toBe(current);
  });

  test('joined de alguien ya presente devuelve la misma referencia', () => {
    const current = new Set(['12']);
    expect(applyPeerPresence(current, { type: 'presence', event: 'joined', from: 12 })).toBe(current);
  });

  test('sin from no cambia nada', () => {
    const current = new Set();
    expect(applyPeerPresence(current, { type: 'presence', event: 'joined', from: null })).toBe(current);
  });
});

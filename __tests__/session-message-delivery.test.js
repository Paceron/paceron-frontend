import { deliveryFor, pickUndeliveredMessages } from '../utils/session-message-delivery.js';

describe('deliveryFor', () => {
  test('info -> solo toast', () => {
    expect(deliveryFor('info')).toEqual({ toast: true, modal: false, haptics: null, sound: false });
  });

  test('aviso -> modal + haptics medio, sin sonido', () => {
    expect(deliveryFor('aviso')).toEqual({ toast: false, modal: true, haptics: 'medium', sound: false });
  });

  test('alerta -> modal + haptics fuerte + sonido', () => {
    expect(deliveryFor('alerta')).toEqual({ toast: false, modal: true, haptics: 'heavy', sound: true });
  });

  test('tipo desconocido cae al comportamiento de info', () => {
    expect(deliveryFor('algo-nuevo')).toEqual({ toast: true, modal: false, haptics: null, sound: false });
  });
});

describe('pickUndeliveredMessages', () => {
  const base = { id: '1', senderUserId: '12', type: 'info', body: 'hola' };

  test('excluye mensajes ya entregados', () => {
    const messages = [base, { ...base, id: '2' }];
    const delivered = new Set(['1']);
    expect(pickUndeliveredMessages(messages, delivered, '99')).toEqual([{ ...base, id: '2' }]);
  });

  test('excluye mensajes propios', () => {
    const messages = [{ ...base, senderUserId: '99' }];
    expect(pickUndeliveredMessages(messages, new Set(), '99')).toEqual([]);
  });

  test('sin mensajes nuevos devuelve array vacío', () => {
    expect(pickUndeliveredMessages([base], new Set(['1']), '99')).toEqual([]);
  });
});

import { groupMessagesByThread } from '../utils/session-message-threads.js';

const msg = (id, overrides = {}) => ({
  id, senderUserId: '1', type: 'info', body: `msg ${id}`, replyToMessageId: null, ...overrides,
});

describe('groupMessagesByThread', () => {
  test('mensajes sin relación quedan cada uno en su propio hilo', () => {
    const messages = [msg('1'), msg('2'), msg('3')];
    const threads = groupMessagesByThread(messages);
    expect(threads).toEqual([
      { rootId: '1', messages: [msg('1')] },
      { rootId: '2', messages: [msg('2')] },
      { rootId: '3', messages: [msg('3')] },
    ]);
  });

  test('una respuesta directa se agrupa con su raíz', () => {
    const root = msg('1');
    const reply = msg('2', { replyToMessageId: '1' });
    const threads = groupMessagesByThread([root, reply]);
    expect(threads).toEqual([{ rootId: '1', messages: [root, reply] }]);
  });

  test('respuestas de varias personas al mismo mensaje caen en un solo hilo', () => {
    const root = msg('1');
    const replyA = msg('2', { replyToMessageId: '1', senderUserId: '2' });
    const replyB = msg('3', { replyToMessageId: '1', senderUserId: '3' });
    const threads = groupMessagesByThread([root, replyA, replyB]);
    expect(threads).toHaveLength(1);
    expect(threads[0].messages.map((m) => m.id)).toEqual(['1', '2', '3']);
  });

  test('una respuesta a una respuesta sigue perteneciendo a la raíz original', () => {
    const root = msg('1');
    const reply = msg('2', { replyToMessageId: '1' });
    const replyToReply = msg('3', { replyToMessageId: '2' });
    const threads = groupMessagesByThread([root, reply, replyToReply]);
    expect(threads).toHaveLength(1);
    expect(threads[0].rootId).toBe('1');
    expect(threads[0].messages.map((m) => m.id)).toEqual(['1', '2', '3']);
  });

  test('reply_to_message_id que no existe en la lista no rompe, queda como su propia raíz', () => {
    const orphan = msg('5', { replyToMessageId: '999' });
    const threads = groupMessagesByThread([orphan]);
    expect(threads).toEqual([{ rootId: '5', messages: [orphan] }]);
  });

  test('hilos distintos mantienen el orden cronológico de su raíz', () => {
    const threadAroot = msg('1');
    const threadBroot = msg('2');
    const threadAreply = msg('3', { replyToMessageId: '1' });
    const threads = groupMessagesByThread([threadAroot, threadBroot, threadAreply]);
    expect(threads.map((t) => t.rootId)).toEqual(['1', '2']);
  });
});

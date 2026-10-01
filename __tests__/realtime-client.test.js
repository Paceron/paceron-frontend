jest.mock('../store/auth-store.js', () => ({
  useAuthStore: { getState: () => ({ token: 'fake-jwt' }) },
}));

class FakeWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }
  send(data) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.({});
  }
  // Helpers de test, no parte de la API real de WebSocket
  simulateOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.({});
  }
  simulateMessage(data) {
    this.onmessage?.({ data });
  }
  simulateClose() {
    this.readyState = 3;
    this.onclose?.({});
  }
}

describe('realtime-client', () => {
  let realtimeClient;

  beforeEach(() => {
    jest.resetModules();
    FakeWebSocket.instances = [];
    global.WebSocket = FakeWebSocket;
    jest.useFakeTimers();
    // eslint-disable-next-line global-require
    realtimeClient = require('../services/realtime-client.js');
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.WebSocket;
  });

  test('connect() opens a socket with the auth token in the URL', () => {
    realtimeClient.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toContain('token=fake-jwt');
  });

  test('connect() is idempotent while a socket is already open', () => {
    realtimeClient.connect();
    FakeWebSocket.instances[0].simulateOpen();
    realtimeClient.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  test('status transitions to open on socket open, and listeners are notified', () => {
    const statusUpdates = [];
    realtimeClient.onStatusChange((status) => statusUpdates.push(status));
    realtimeClient.connect();
    expect(realtimeClient.getStatus()).toBe('connecting');
    FakeWebSocket.instances[0].simulateOpen();
    expect(realtimeClient.getStatus()).toBe('open');
    expect(statusUpdates).toContain('open');
  });

  test('subscribe() before the socket opens is sent once the socket opens', () => {
    realtimeClient.connect();
    realtimeClient.subscribe('session:42');
    const socket = FakeWebSocket.instances[0];
    expect(socket.sent).toHaveLength(0); // no envía nada mientras conecta
    socket.simulateOpen();
    const sentSubscribe = socket.sent.map((s) => JSON.parse(s)).find((m) => m.type === 'subscribe');
    expect(sentSubscribe).toMatchObject({ type: 'subscribe', channel: 'session:42' });
  });

  test('on(channel, cb) receives messages dispatched for that channel only', () => {
    realtimeClient.connect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    const received = [];
    const otherReceived = [];
    realtimeClient.on('session:42', (msg) => received.push(msg));
    realtimeClient.on('session:99', (msg) => otherReceived.push(msg));
    socket.simulateMessage(JSON.stringify({ channel: 'session:42', type: 'control', event: 'announcement', ts: 1 }));
    expect(received).toHaveLength(1);
    expect(otherReceived).toHaveLength(0);
  });

  test('off(channel, cb) stops delivering messages to that callback', () => {
    realtimeClient.connect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    const received = [];
    const handler = (msg) => received.push(msg);
    realtimeClient.on('session:42', handler);
    realtimeClient.off('session:42', handler);
    socket.simulateMessage(JSON.stringify({ channel: 'session:42', type: 'control', ts: 1 }));
    expect(received).toHaveLength(0);
  });

  test('send() writes an enveloped message when the socket is open', () => {
    realtimeClient.connect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    realtimeClient.send('session:42', 'presence', undefined, { event: 'joined' });
    const sentJoin = socket.sent.map((s) => JSON.parse(s)).find((m) => m.type === 'presence');
    expect(sentJoin).toMatchObject({ channel: 'session:42', type: 'presence', event: 'joined' });
  });

  test('send() is a silent no-op when the socket is not open', () => {
    realtimeClient.connect(); // todavía CONNECTING, no OPEN
    expect(() => realtimeClient.send('session:42', 'presence', undefined, { event: 'position' })).not.toThrow();
  });

  test('an unexpected close schedules a reconnect and status becomes reconnecting', () => {
    realtimeClient.connect();
    FakeWebSocket.instances[0].simulateOpen();
    FakeWebSocket.instances[0].simulateClose();
    expect(realtimeClient.getStatus()).toBe('reconnecting');
    jest.advanceTimersByTime(35000); // más que el backoff máximo (30s)
    expect(FakeWebSocket.instances).toHaveLength(2); // se abrió un segundo socket
  });

  test('resubscribes to previously subscribed channels after a reconnect', () => {
    realtimeClient.connect();
    realtimeClient.subscribe('session:42');
    FakeWebSocket.instances[0].simulateOpen();
    FakeWebSocket.instances[0].simulateClose();
    jest.advanceTimersByTime(35000);
    const secondSocket = FakeWebSocket.instances[1];
    secondSocket.simulateOpen();
    const sentSubscribe = secondSocket.sent.map((s) => JSON.parse(s)).find((m) => m.type === 'subscribe' && m.channel === 'session:42');
    expect(sentSubscribe).toBeDefined();
  });

  test('unsubscribe() removes the channel from the resubscribe list', () => {
    realtimeClient.connect();
    realtimeClient.subscribe('session:42');
    FakeWebSocket.instances[0].simulateOpen();
    realtimeClient.unsubscribe('session:42');
    FakeWebSocket.instances[0].simulateClose();
    jest.advanceTimersByTime(35000);
    const secondSocket = FakeWebSocket.instances[1];
    secondSocket.simulateOpen();
    const sentSubscribe = secondSocket.sent.map((s) => JSON.parse(s)).find((m) => m.type === 'subscribe' && m.channel === 'session:42');
    expect(sentSubscribe).toBeUndefined();
  });

  test('a pong message is swallowed and never dispatched to channel listeners', () => {
    realtimeClient.connect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    const received = [];
    realtimeClient.on('session:42', (msg) => received.push(msg));
    socket.simulateMessage(JSON.stringify({ type: 'pong', ts: 1 }));
    expect(received).toHaveLength(0);
  });

  test('an unparseable message is ignored without throwing', () => {
    realtimeClient.connect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    expect(() => socket.simulateMessage('not-json{{')).not.toThrow();
  });

  // onSubscribed/offSubscribed: el ACK real del servidor (no "ya pedimos
  // suscribirnos") es lo que gatea anunciar presence:joined -- ver el
  // comentario en hooks/use-realtime-channel.js para el bug que esto arregla.
  test('onSubscribed(channel, cb) fires when the server confirms that channel subscribed', () => {
    realtimeClient.connect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    const acks = [];
    realtimeClient.onSubscribed('session:42', () => acks.push('session:42'));
    socket.simulateMessage(JSON.stringify({ type: 'subscribed', channel: 'session:99' }));
    expect(acks).toHaveLength(0); // canal distinto, no dispara
    socket.simulateMessage(JSON.stringify({ type: 'subscribed', channel: 'session:42' }));
    expect(acks).toEqual(['session:42']);
  });

  test('a subscribed ack is never dispatched to regular channel listeners', () => {
    realtimeClient.connect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    const received = [];
    realtimeClient.on('session:42', (msg) => received.push(msg));
    socket.simulateMessage(JSON.stringify({ type: 'subscribed', channel: 'session:42' }));
    expect(received).toHaveLength(0);
  });

  test('offSubscribed(channel, cb) stops delivering acks to that callback', () => {
    realtimeClient.connect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    const acks = [];
    const handler = () => acks.push('fired');
    realtimeClient.onSubscribed('session:42', handler);
    realtimeClient.offSubscribed('session:42', handler);
    socket.simulateMessage(JSON.stringify({ type: 'subscribed', channel: 'session:42' }));
    expect(acks).toHaveLength(0);
  });

  test('resubscribing (reconnect) fires onSubscribed again -- re-announces joined', () => {
    realtimeClient.connect();
    realtimeClient.subscribe('session:42');
    const acks = [];
    realtimeClient.onSubscribed('session:42', () => acks.push('ack'));
    const ackMsg = JSON.stringify({ type: 'subscribed', channel: 'session:42' });
    FakeWebSocket.instances[0].simulateOpen();
    FakeWebSocket.instances[0].simulateMessage(ackMsg); // el servidor confirma la 1ra suscripción
    expect(acks).toEqual(['ack']);
    FakeWebSocket.instances[0].simulateClose();
    jest.advanceTimersByTime(35000);
    FakeWebSocket.instances[1].simulateOpen();
    FakeWebSocket.instances[1].simulateMessage(ackMsg); // y de nuevo tras la reconexión
    expect(acks).toEqual(['ack', 'ack']);
  });
});

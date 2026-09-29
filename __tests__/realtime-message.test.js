import { buildMessage, buildWsUrl, parseMessage } from '../utils/realtime-message.js';

describe('buildMessage', () => {
  test('includes channel, type and a numeric ts', () => {
    const msg = buildMessage({ channel: 'session:42', type: 'presence', event: 'joined' });
    expect(msg.channel).toBe('session:42');
    expect(msg.type).toBe('presence');
    expect(msg.event).toBe('joined');
    expect(typeof msg.ts).toBe('number');
  });

  test('omits optional fields that were not provided', () => {
    const msg = buildMessage({ channel: 'session:42', type: 'ping' });
    expect(msg).not.toHaveProperty('event');
    expect(msg).not.toHaveProperty('to');
    expect(msg).not.toHaveProperty('payload');
    expect(msg).not.toHaveProperty('from');
  });

  test('includes to and payload when provided', () => {
    const msg = buildMessage({ channel: 'session:42', type: 'control', event: 'session_finished', to: 'all', payload: { reason: 'window_ended' } });
    expect(msg.to).toBe('all');
    expect(msg.payload).toEqual({ reason: 'window_ended' });
  });

  test('never lets a caller set `from` — that field is server-assigned only', () => {
    const msg = buildMessage({ channel: 'session:42', type: 'presence', event: 'joined', from: { userId: 999, role: 'trainer' } });
    expect(msg).not.toHaveProperty('from');
  });
});

describe('parseMessage', () => {
  test('parses a valid JSON envelope', () => {
    const raw = JSON.stringify({ channel: 'session:42', type: 'control', event: 'session_paused', ts: 123 });
    expect(parseMessage(raw)).toEqual({ channel: 'session:42', type: 'control', event: 'session_paused', ts: 123 });
  });

  test('returns null for invalid JSON', () => {
    expect(parseMessage('not json{{{')).toBeNull();
  });

  test('returns null when the parsed value has no string `type`', () => {
    expect(parseMessage(JSON.stringify({ channel: 'session:42', ts: 1 }))).toBeNull();
    expect(parseMessage(JSON.stringify({ type: 42 }))).toBeNull();
  });

  test('returns null for non-object JSON', () => {
    expect(parseMessage(JSON.stringify('hello'))).toBeNull();
    expect(parseMessage(JSON.stringify(null))).toBeNull();
  });
});

describe('buildWsUrl', () => {
  test('converts an https API base URL with a path suffix to a wss /ws URL', () => {
    expect(buildWsUrl('https://paceron-backend-as9c.onrender.com/api/v1')).toBe('wss://paceron-backend-as9c.onrender.com/ws');
  });

  test('converts an http (local dev) API base URL to a plain ws /ws URL', () => {
    expect(buildWsUrl('http://localhost:8080/api/v1')).toBe('ws://localhost:8080/ws');
  });

  test('handles a base URL without a path suffix', () => {
    expect(buildWsUrl('https://example.com')).toBe('wss://example.com/ws');
  });

  test('handles a base URL with a trailing slash', () => {
    expect(buildWsUrl('https://example.com/api/v1/')).toBe('wss://example.com/ws');
  });
});

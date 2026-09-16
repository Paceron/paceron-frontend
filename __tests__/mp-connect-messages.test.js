import { resolveMpConnectErrorText, resolveMpConnectMessage } from '../utils/mp-connect-messages.js';

describe('resolveMpConnectMessage', () => {
  it('resuelve el éxito', () => {
    const result = resolveMpConnectMessage('success');
    expect(result.ok).toBe(true);
    expect(result.title).toBe('Configuración de cobros exitosa');
  });

  // Los slugs son el contrato del backend (mapCallbackReason). Si el backend
  // suma uno nuevo y acá no se agrega, cae al mensaje genérico en vez de
  // romper — pero este test deja explícito cuáles se conocen hoy.
  it.each([
    'bad_request',
    'missing_params',
    'invalid_state',
    'expired_state',
    'authorization_denied',
    'config_error',
    'exchange_failed',
    'save_failed',
    'unknown_error',
  ])('tiene un mensaje propio para reason=%s', (reason) => {
    const result = resolveMpConnectMessage('error', reason);
    expect(result.ok).toBe(false);
    expect(result.title).toBe('Algo salió mal');
    expect(result.detail).toBeTruthy();
  });

  it('distingue el enlace vencido del inválido', () => {
    expect(resolveMpConnectMessage('error', 'expired_state').detail)
      .not.toBe(resolveMpConnectMessage('error', 'invalid_state').detail);
  });

  it('cae al mensaje genérico con un reason desconocido', () => {
    const result = resolveMpConnectMessage('error', 'reason_que_no_existe');
    expect(result.ok).toBe(false);
    expect(result.detail).toBe(resolveMpConnectMessage('error', 'unknown_error').detail);
  });

  // Nunca se muestra el slug crudo: el backend lo manda justamente para no
  // filtrar el texto del error a la URL.
  it('no filtra el slug al texto visible', () => {
    const result = resolveMpConnectMessage('error', 'exchange_failed');
    expect(result.detail).not.toContain('exchange_failed');
  });

  it('trata un status ausente o desconocido como error', () => {
    expect(resolveMpConnectMessage(undefined).ok).toBe(false);
    expect(resolveMpConnectMessage('lo-que-sea').ok).toBe(false);
  });
});

describe('resolveMpConnectErrorText', () => {
  it('traduce un slug del backend', () => {
    expect(resolveMpConnectErrorText(new Error('expired_state')))
      .toBe(resolveMpConnectMessage('error', 'expired_state').detail);
  });

  // Un fallo de red no es un slug: su mensaje ya viene en español desde
  // utils/network-errors.js y se muestra tal cual.
  it('deja pasar un mensaje de error real', () => {
    expect(resolveMpConnectErrorText(new Error('No pudimos conectarnos al servidor.')))
      .toBe('No pudimos conectarnos al servidor.');
  });

  it('cae al genérico sin error o sin mensaje', () => {
    const generico = resolveMpConnectMessage('error', 'unknown_error').detail;
    expect(resolveMpConnectErrorText(undefined)).toBe(generico);
    expect(resolveMpConnectErrorText(new Error(''))).toBe(generico);
  });
});

import { DEVELOP_WEB_ORIGIN, PRODUCTION_WEB_ORIGIN, resolveWebOrigin } from '../config/web-origin.js';

describe('resolveWebOrigin', () => {
  it('pairs the develop backend with the develop web preview', () => {
    expect(resolveWebOrigin('https://paceron-backend-as9c.onrender.com/api/v1')).toBe(DEVELOP_WEB_ORIGIN);
  });

  it('pairs the production backend with the production web', () => {
    expect(resolveWebOrigin('https://paceron-backend.onrender.com/api/v1')).toBe(PRODUCTION_WEB_ORIGIN);
  });

  it('falls back to the develop web for an unknown or local backend', () => {
    expect(resolveWebOrigin('http://192.168.1.59:8080/api/v1')).toBe(DEVELOP_WEB_ORIGIN);
    expect(resolveWebOrigin('not a url')).toBe(DEVELOP_WEB_ORIGIN);
    expect(resolveWebOrigin(undefined)).toBe(DEVELOP_WEB_ORIGIN);
  });

  it('lets an explicit override win and drops its trailing slash', () => {
    expect(resolveWebOrigin('https://paceron-backend.onrender.com/api/v1', 'http://192.168.1.23:8082/')).toBe('http://192.168.1.23:8082');
  });

  it('ignores a blank override', () => {
    expect(resolveWebOrigin('https://paceron-backend.onrender.com/api/v1', '  ')).toBe(PRODUCTION_WEB_ORIGIN);
  });
});

import { useAuthStore } from '../store/auth-store.js';

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null });
});

describe('auth store', () => {
  test('starts with no user and no token', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  test('logout clears user and token', () => {
    useAuthStore.setState({ user: { name: 'Test' }, token: 'abc' });
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  test('clearUser clears user and token', () => {
    useAuthStore.setState({ user: { name: 'Test' }, token: 'abc' });
    useAuthStore.getState().clearUser();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });
});

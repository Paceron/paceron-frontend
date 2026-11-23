let mockPathname = '/home';

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

import { act, renderHook } from '@testing-library/react-native';
import { usePageReveal } from '../hooks/use-page-reveal.js';

const setPathname = (nextPathname) => {
  mockPathname = nextPathname;
};

describe('usePageReveal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPathname = '/home';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('pasa de hidden a load cuando termina la espera', () => {
    const { result } = renderHook(() => usePageReveal({ settleMs: 120 }));

    expect(result.current.phase).toBe('hidden');
    expect(result.current.visible).toBe(false);

    act(() => {
      jest.advanceTimersByTime(120);
    });

    expect(result.current.phase).toBe('load');
    expect(result.current.visible).toBe(true);
  });

  test('puede arrancar en load para revelar sin espera', () => {
    const { result } = renderHook(() => usePageReveal({ initialPhase: 'load' }));

    expect(result.current.phase).toBe('load');
    expect(result.current.visible).toBe(true);
  });

  test('vuelve a hidden mientras carga y se revela al terminar', () => {
    const { result, rerender } = renderHook(
      ({ loading }) => usePageReveal({ initialPhase: 'load', loading, settleMs: 0 }),
      { initialProps: { loading: false } },
    );

    rerender({ loading: true });
    expect(result.current.phase).toBe('hidden');

    rerender({ loading: false });
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(result.current.phase).toBe('load');
  });

  test('revela de nuevo cuando cambia la ruta', () => {
    const { result, rerender } = renderHook(() => usePageReveal({ initialPhase: 'load' }));

    expect(result.current.phase).toBe('load');

    setPathname('/calendar');
    rerender({});

    expect(result.current.phase).toBe('return');
    expect(result.current.revealKey).toBe(2);
  });
});

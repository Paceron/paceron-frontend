jest.mock('react-native-reanimated', () => ({
  Easing: { cubic: 0, out: (value) => value },
  useAnimatedStyle: (styleFn) => styleFn(),
  useReducedMotion: () => false,
  useSharedValue: (value) => ({ value }),
  withDelay: (_delay, animation) => animation,
  withTiming: (value) => value,
}));

import { resolveRevealStart } from '../components/home/home-reveal.jsx';

describe('resolveRevealStart', () => {
  test('arranca en cero en la primera carga', () => {
    expect(resolveRevealStart('load', false)).toBe(0);
  });

  test('también arranca en cero al volver al Home', () => {
    expect(resolveRevealStart('return', false)).toBe(0);
  });

  test('queda visible de entrada con reduced motion', () => {
    expect(resolveRevealStart('return', true)).toBe(1);
  });
});

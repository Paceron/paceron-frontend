import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockSetPendingSession = jest.fn();
let mockRole = 'runner';
let mockIsWeb = false;

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { cubic: 0, linear: 0, out: (value) => value },
    useAnimatedStyle: (styleFn) => styleFn(),
    useSharedValue: (value) => ({ value }),
    withTiming: (value) => value,
  };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../theme/colors.js', () => ({ useThemeColors: () => ({ primary: '#168a52' }) }));
jest.mock('../providers/theme-provider.jsx', () => ({ useThemeMode: () => ({ colorScheme: 'light' }) }));
jest.mock('../hooks/use-arrow-bounce.js', () => ({ useArrowBounce: () => ({}) }));
jest.mock('../utils/format-date-display.js', () => ({
  formatDisplayDate: (date) => date,
  formatWeekdayLabel: () => 'Vie',
}));
jest.mock('../hooks/use-next-training-banner.js', () => ({ useNextTrainingBanner: jest.fn() }));
jest.mock('../store/auth-store.js', () => ({
  useAuthStore: (selector) => selector({ activeRole: mockRole, userId: 8 }),
}));
jest.mock('../store/session-runtime-store.js', () => ({
  useSessionRuntimeStore: (selector) => selector({ setPendingSession: mockSetPendingSession }),
}));
jest.mock('../utils/platform.js', () => ({ get isWeb() { return mockIsWeb; } }));
jest.mock('../utils/session-start-window.js', () => ({ canStartSession: () => true }));

// eslint-disable-next-line import/first -- los mocks deben registrarse antes del componente.
import { useNextTrainingBanner } from '../hooks/use-next-training-banner.js';
// eslint-disable-next-line import/first -- los mocks deben registrarse antes del componente.
import { NextTrainingBanner } from '../components/home/next-training-banner.jsx';

const TRAININGS = [
  {
    date: '2026-11-20',
    groupId: '11',
    groupName: 'Tigres',
    teamId: '3',
    teamName: 'Equipo Norte',
    isPresencial: false,
    sessionInstance: { id: '101', name: 'Fondo' },
  },
  {
    date: '2026-11-20',
    groupId: '12',
    groupName: 'Leones',
    teamId: '4',
    teamName: 'Equipo Sur',
    isPresencial: false,
    sessionInstance: { id: '102', name: 'Intervalos' },
  },
];

function mockBanner(nextTrainings) {
  useNextTrainingBanner.mockReturnValue({
    nextTraining: nextTrainings[0] ?? null,
    nextTrainings,
    cancelledSessions: [],
    loading: false,
    isFetching: false,
  });
}

describe('NextTrainingBanner carousel', () => {
  beforeEach(() => {
    mockRole = 'runner';
    mockIsWeb = false;
    mockPush.mockClear();
    mockSetPendingSession.mockClear();
    mockBanner(TRAININGS);
  });

  it('shows carousel controls only when there are multiple sessions', () => {
    mockBanner([TRAININGS[0]]);

    const { getByTestId, queryByTestId } = render(<NextTrainingBanner />);

    expect(getByTestId('next-training-banner-hero')).toBeTruthy();
    expect(getByTestId('next-training-banner-hero-title').props.children).toBe('Fondo');
    expect(queryByTestId('next-training-banner-hero-position')).toBeNull();
    expect(queryByTestId('next-training-banner-hero-next')).toBeNull();
    expect(queryByTestId('next-training-banner-hero-autoplay-track')).toBeNull();
  });

  it('uses the tallest content height for every carousel card', () => {
    const { getByTestId } = render(<NextTrainingBanner />);

    fireEvent(getByTestId('next-training-banner-hero-1-reveal'), 'layout', {
      nativeEvent: { layout: { height: 120 } },
    });
    fireEvent(getByTestId('next-training-banner-hero-2-reveal'), 'layout', {
      nativeEvent: { layout: { height: 170 } },
    });

    const firstHeight = StyleSheet.flatten(getByTestId('next-training-banner-hero-1').props.style)?.height;
    const secondHeight = StyleSheet.flatten(getByTestId('next-training-banner-hero-2').props.style)?.height;
    expect(firstHeight).toBe(202);
    expect(secondHeight).toBe(202);
  });

  it('uses the tallest inner content card height for every carousel card', () => {
    const { getByTestId } = render(<NextTrainingBanner />);

    fireEvent(getByTestId('next-training-banner-hero-1-text'), 'layout', {
      nativeEvent: { layout: { height: 120 } },
    });
    fireEvent(getByTestId('next-training-banner-hero-2-text'), 'layout', {
      nativeEvent: { layout: { height: 170 } },
    });

    expect(StyleSheet.flatten(getByTestId('next-training-banner-hero-1-text').props.style)?.minHeight).toBe(170);
    expect(StyleSheet.flatten(getByTestId('next-training-banner-hero-2-text').props.style)?.minHeight).toBe(170);
  });

  it('renders both carousel arrows with a stable touch lane and narrow glyphs', () => {
    const { getByTestId } = render(<NextTrainingBanner />);

    const previous = getByTestId('next-training-banner-hero-1-previous');
    const next = getByTestId('next-training-banner-hero-1-next');
    expect(StyleSheet.flatten(previous.props.style)?.width).toBe(28);
    expect(StyleSheet.flatten(next.props.style)?.width).toBe(28);
    expect(getByTestId('next-training-banner-hero-1-previous-glyph').props.children).toBe('<');
    expect(getByTestId('next-training-banner-hero-1-next-glyph').props.children).toBe('>');
  });

  it('changes the selected session and starts that session', () => {
    const { getByTestId, queryByTestId } = render(<NextTrainingBanner />);

    expect(getByTestId('next-training-banner-hero-1-title').props.children).toBe('Fondo');
    fireEvent.press(getByTestId('next-training-banner-hero-1-next'));
    expect(getByTestId('next-training-banner-hero-2-title').props.children).toBe('Intervalos');
    expect(getByTestId('next-training-banner-hero-2-position').props.children).toBe('(2/2)');
    expect(getByTestId('next-training-banner-hero-2-previous')).toBeTruthy();
    expect(getByTestId('next-training-banner-hero-2-next')).toBeTruthy();
    expect(getByTestId('next-training-banner-hero-2-autoplay-track')).toBeTruthy();
    expect(queryByTestId('next-training-banner-hero-1-autoplay-track')).toBeNull();
    expect(mockSetPendingSession).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('next-training-banner-hero-2'));

    expect(mockSetPendingSession).toHaveBeenCalledWith(TRAININGS[1]);
    expect(mockPush).toHaveBeenCalledWith('/training-session');
  });

  it('changes the selected session after a horizontal swipe', () => {
    const { getByTestId } = render(<NextTrainingBanner />);
    fireEvent(getByTestId('next-training-banner-carousel'), 'layout', {
      nativeEvent: { layout: { width: 320 } },
    });
    fireEvent(getByTestId('next-training-banner-carousel-pages'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 320, y: 0 } },
    });

    expect(getByTestId('next-training-banner-hero-2-position').props.children).toBe('(2/2)');
    expect(getByTestId('next-training-banner-hero-2-title').props.children).toBe('Intervalos');
  });

  it('advances automatically every 20 seconds and wraps to the first session', () => {
    jest.useFakeTimers();
    const { getByTestId, unmount } = render(<NextTrainingBanner />);
    fireEvent(getByTestId('next-training-banner-carousel'), 'layout', {
      nativeEvent: { layout: { width: 320 } },
    });

    act(() => {
      jest.advanceTimersByTime(20000);
    });
    expect(getByTestId('next-training-banner-hero-2-position').props.children).toBe('(2/2)');

    act(() => {
      jest.advanceTimersByTime(20000);
    });
    expect(getByTestId('next-training-banner-hero-1-position').props.children).toBe('(1/2)');

    unmount();
    jest.useRealTimers();
  });

  it('navigates the trainer to the selected group day on web', () => {
    mockRole = 'trainer';
    mockIsWeb = true;
    mockBanner(TRAININGS.map((session) => ({ ...session, isPresencial: true })));

    const { getByTestId } = render(<NextTrainingBanner />);
    fireEvent.press(getByTestId('next-training-banner-hero-1-next'));
    fireEvent.press(getByTestId('next-training-banner-hero-2'));

    expect(mockSetPendingSession).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/teams/4/groups/12/calendar/2026-11-20');
  });
});

describe('NextTrainingBanner autoplay transitions', () => {
  beforeEach(() => {
    mockRole = 'runner';
    mockIsWeb = false;
    mockPush.mockClear();
    mockSetPendingSession.mockClear();
    mockBanner(TRAININGS);
  });

  it('ignores stale scroll events fired while the autoplay scroll starts', () => {
    jest.useFakeTimers();
    const { getByTestId, unmount } = render(<NextTrainingBanner />);
    fireEvent(getByTestId('next-training-banner-carousel'), 'layout', {
      nativeEvent: { layout: { width: 320 } },
    });

    act(() => {
      jest.advanceTimersByTime(20000);
    });
    expect(getByTestId('next-training-banner-hero-2-position').props.children).toBe('(2/2)');

    fireEvent.scroll(getByTestId('next-training-banner-carousel-pages'), {
      nativeEvent: { contentOffset: { x: 0, y: 0 } },
    });
    expect(getByTestId('next-training-banner-hero-2-position').props.children).toBe('(2/2)');
    expect(getByTestId('next-training-banner-hero-2-autoplay-track')).toBeTruthy();

    unmount();
    jest.useRealTimers();
  });

  it('keeps the selected slide through a slow manual transition', () => {
    jest.useFakeTimers();
    const { getByTestId, queryByTestId, unmount } = render(<NextTrainingBanner />);
    fireEvent(getByTestId('next-training-banner-carousel'), 'layout', {
      nativeEvent: { layout: { width: 320 } },
    });

    fireEvent.press(getByTestId('next-training-banner-hero-1-next'));
    expect(getByTestId('next-training-banner-hero-2-position').props.children).toBe('(2/2)');

    act(() => {
      jest.advanceTimersByTime(800);
    });
    fireEvent.scroll(getByTestId('next-training-banner-carousel-pages'), {
      nativeEvent: { contentOffset: { x: 80, y: 0 } },
    });

    expect(getByTestId('next-training-banner-hero-2-position').props.children).toBe('(2/2)');
    expect(getByTestId('next-training-banner-hero-2-autoplay-track')).toBeTruthy();
    expect(queryByTestId('next-training-banner-hero-1-autoplay-track')).toBeNull();

    unmount();
    jest.useRealTimers();
  });
});

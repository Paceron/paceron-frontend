import { render } from '@testing-library/react-native';
import { HomeLoadingOverlay } from '../components/home/home-loading-overlay.jsx';

jest.mock('../theme/colors.js', () => ({
  useThemeColors: () => ({ primary: '#8cc63e' }),
}));

describe('HomeLoadingOverlay', () => {
  test('renders the general spinner while visible', () => {
    const { getByTestId } = render(<HomeLoadingOverlay visible />);

    expect(getByTestId('home-loading-overlay')).toBeTruthy();
  });

  test('unmounts immediately when it stops being visible', () => {
    const { queryByTestId, rerender } = render(<HomeLoadingOverlay visible />);

    rerender(<HomeLoadingOverlay visible={false} />);

    expect(queryByTestId('home-loading-overlay')).toBeNull();
  });
});

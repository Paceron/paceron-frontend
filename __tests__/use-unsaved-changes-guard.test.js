import { act, renderHook } from '@testing-library/react-native';

const mockDispatch = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: jest.fn(),
}));

import { useUnsavedChangesGuard } from '../hooks/use-unsaved-changes-guard.js';

describe('useUnsavedChangesGuard', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  test('vuelve a pedir confirmación después de cerrar y reabrir un modal sucio', () => {
    const { result, rerender } = renderHook(
      ({ isDirty }) => useUnsavedChangesGuard(isDirty),
      { initialProps: { isDirty: true } },
    );

    act(() => result.current.confirmDiscard());
    rerender({ isDirty: false });
    rerender({ isDirty: true });

    const closeFn = jest.fn();
    act(() => result.current.guardedClose(closeFn));

    expect(closeFn).not.toHaveBeenCalled();
    expect(result.current.confirmVisible).toBe(true);
  });
});

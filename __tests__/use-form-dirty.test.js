import { renderHook, act } from '@testing-library/react-native';
import { useState } from 'react';
import { useFormDirty } from '../hooks/use-form-dirty.js';

function useDirtyHarness(initialValues, initialResetKey) {
  const [values, setValues] = useState(initialValues);
  const [resetKey, setResetKey] = useState(initialResetKey);
  const isDirty = useFormDirty(values, resetKey);
  return { values, setValues, resetKey, setResetKey, isDirty };
}

test('no está dirty si los valores no cambiaron desde el primer render', () => {
  const { result } = renderHook(() => useDirtyHarness({ name: 'Ana' }));
  expect(result.current.isDirty).toBe(false);
});

test('queda dirty cuando los valores cambian', () => {
  const { result } = renderHook(() => useDirtyHarness({ name: 'Ana' }));
  act(() => { result.current.setValues({ name: 'Ana María' }); });
  expect(result.current.isDirty).toBe(true);
});

test('vuelve a false si los valores vuelven al snapshot original', () => {
  const { result } = renderHook(() => useDirtyHarness({ name: 'Ana' }));
  act(() => { result.current.setValues({ name: 'Ana María' }); });
  act(() => { result.current.setValues({ name: 'Ana' }); });
  expect(result.current.isDirty).toBe(false);
});

test('resetKey re-captura el snapshot base (caso modal reabierto)', () => {
  const { result } = renderHook(() => useDirtyHarness({ name: 'Ana' }, 'session-1'));
  act(() => { result.current.setValues({ name: 'Ana María' }); });
  expect(result.current.isDirty).toBe(true);

  // Reabrir el modal con otro registro: cambia resetKey y los valores
  // precargados a la vez, como hace CreateSessionModal al abrir.
  act(() => {
    result.current.setValues({ name: 'Otro' });
    result.current.setResetKey('session-2');
  });
  expect(result.current.isDirty).toBe(false);
});

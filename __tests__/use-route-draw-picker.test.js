import { renderHook, act } from '@testing-library/react-native';
import { useRouteDrawPicker } from '../hooks/use-route-draw-picker.js';

describe('useRouteDrawPicker', () => {
  test('arranca vacío, agregar puntos crece la lista', () => {
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    expect(result.current.points).toEqual([]);
    act(() => result.current.addPoint(-34.6, -58.4));
    act(() => result.current.addPoint(-34.61, -58.4));
    expect(result.current.points).toHaveLength(2);
    expect(result.current.canConfirm).toBe(true);
  });

  test('con menos de 2 puntos no se puede confirmar', () => {
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    act(() => result.current.addPoint(-34.6, -58.4));
    expect(result.current.canConfirm).toBe(false);
  });

  test('undoLast sacar el último punto agregado', () => {
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    act(() => result.current.addPoint(-34.6, -58.4));
    act(() => result.current.addPoint(-34.61, -58.4));
    act(() => result.current.undoLast());
    expect(result.current.points).toHaveLength(1);
  });

  test('clear vacía todo', () => {
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    act(() => result.current.addPoint(-34.6, -58.4));
    act(() => result.current.clear());
    expect(result.current.points).toEqual([]);
  });

  test('confirm llama onChange con un GeoJSON LineString, coords [lng,lat]', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange }));
    act(() => result.current.addPoint(-34.6, -58.4));
    act(() => result.current.addPoint(-34.61, -58.41));
    act(() => result.current.confirm());
    expect(onChange).toHaveBeenCalledWith({
      type: 'LineString',
      coordinates: [[-58.4, -34.6], [-58.41, -34.61]],
    });
  });

  test('confirm con menos de 2 puntos no llama onChange', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange }));
    act(() => result.current.addPoint(-34.6, -58.4));
    act(() => result.current.confirm());
    expect(onChange).not.toHaveBeenCalled();
  });

  test('con un value GeoJSON previo, arranca con esos puntos cargados', () => {
    const value = { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] };
    const { result } = renderHook(() => useRouteDrawPicker({ value, onChange: () => {} }));
    expect(result.current.points).toEqual([{ lat: -34.6, lng: -58.4 }, { lat: -34.61, lng: -58.41 }]);
  });
});

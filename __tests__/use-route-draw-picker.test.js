import { renderHook, act } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { useRouteDrawPicker } from '../hooks/use-route-draw-picker.js';

// expo-location publica ESM puro (`export { ... } from 'expo-modules-core'`)
// -- no está en el transformIgnorePatterns de jest.config.js (solo expo(nent)?,
// no expo-location con guión) y hasta este test ningún hook con GPS tenía
// cobertura, así que nunca hizo falta. Mock local en vez de tocar la config
// global -- alcance mínimo, sin arriesgar otros tests. jest.mock se hoistea
// arriba de los imports de todas formas (babel-plugin-jest-hoist).
jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));

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

  test('confirmed se prende con confirm() y se apaga con cualquier edición posterior', () => {
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    expect(result.current.confirmed).toBe(false);
    act(() => result.current.addPoint(-34.6, -58.4));
    act(() => result.current.addPoint(-34.61, -58.41));
    act(() => result.current.confirm());
    expect(result.current.confirmed).toBe(true);
    act(() => result.current.addPoint(-34.62, -58.42));
    expect(result.current.confirmed).toBe(false);
  });

  test('confirmed se apaga con undoLast y con clear también', () => {
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    act(() => result.current.addPoint(-34.6, -58.4));
    act(() => result.current.addPoint(-34.61, -58.41));
    act(() => result.current.confirm());
    act(() => result.current.undoLast());
    expect(result.current.confirmed).toBe(false);

    act(() => result.current.addPoint(-34.61, -58.41));
    act(() => result.current.confirm());
    act(() => result.current.clear());
    expect(result.current.confirmed).toBe(false);
  });
});

describe('useRouteDrawPicker — locateMe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sin permiso -> locateError seteado, devuelve null', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    let coords;
    await act(async () => { coords = await result.current.locateMe(); });
    expect(coords).toBeNull();
    expect(result.current.locateError).toBe('Necesitamos permiso de ubicación para esto.');
  });

  test('con permiso y fix de GPS -> devuelve {lat,lng}, sin error', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: -34.6, longitude: -58.4 } });
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    let coords;
    await act(async () => { coords = await result.current.locateMe(); });
    expect(coords).toEqual({ lat: -34.6, lng: -58.4 });
    expect(result.current.locateError).toBeNull();
  });

  test('getCurrentPositionAsync falla -> cae a getLastKnownPositionAsync', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getCurrentPositionAsync.mockRejectedValue(new Error('sin fix'));
    Location.getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: -34.61, longitude: -58.41 } });
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    let coords;
    await act(async () => { coords = await result.current.locateMe(); });
    expect(coords).toEqual({ lat: -34.61, lng: -58.41 });
  });

  test('ninguna posición disponible -> locateError, devuelve null', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getCurrentPositionAsync.mockRejectedValue(new Error('sin fix'));
    Location.getLastKnownPositionAsync.mockResolvedValue(null);
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    let coords;
    await act(async () => { coords = await result.current.locateMe(); });
    expect(coords).toBeNull();
    expect(result.current.locateError).toBe('No pudimos obtener tu ubicación actual.');
  });
});

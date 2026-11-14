import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('../utils/platform.js', () => ({ isWeb: true }));

// eslint-disable-next-line import/first -- los mocks de arriba tienen que registrarse antes del componente.
import { KpiTooltip } from '../components/dashboard/kpi-tooltip.jsx';

// En web el bubble tiene que cerrarse con un clic en cualquier lugar de la
// pantalla (y con Escape), no solo con el mismo "i". El componente escucha
// `pointerdown` en el documento; acá se simula ese listener.
const listeners = new Map();
const documentMock = {
  addEventListener: jest.fn((type, handler) => listeners.set(type, handler)),
  removeEventListener: jest.fn((type) => listeners.delete(type)),
};

beforeEach(() => {
  listeners.clear();
  documentMock.addEventListener.mockClear();
  documentMock.removeEventListener.mockClear();
  global.document = documentMock;
});

afterEach(() => {
  delete global.document;
});

function renderTooltip(props = {}) {
  return render(
    <KpiTooltip definition="Tu ritmo de carrera en el período." id="kpi" {...props}>
      <Text nativeID="kpi-child" testID="kpi-child">12,4 km/h</Text>
    </KpiTooltip>,
  );
}

describe('KpiTooltip — cierre al hacer clic afuera (web)', () => {
  test('registra el listener solo mientras está abierto', () => {
    const { getByTestId } = renderTooltip();

    expect(documentMock.addEventListener).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('kpi-trigger'));
    expect(listeners.has('pointerdown')).toBe(true);
    expect(listeners.has('keydown')).toBe(true);

    fireEvent.press(getByTestId('kpi-trigger'));
    expect(listeners.has('pointerdown')).toBe(false);
    expect(listeners.has('keydown')).toBe(false);
  });

  test('un clic fuera de la tarjeta cierra el bubble', () => {
    const { getByTestId, queryByTestId } = renderTooltip();

    fireEvent.press(getByTestId('kpi-trigger'));
    expect(getByTestId('kpi-bubble')).toBeTruthy();

    act(() => {
      listeners.get('pointerdown')({ target: null });
    });

    expect(queryByTestId('kpi-bubble')).toBeNull();
  });

  test('Escape también lo cierra', () => {
    const { getByTestId, queryByTestId } = renderTooltip();

    fireEvent.press(getByTestId('kpi-trigger'));
    expect(getByTestId('kpi-bubble')).toBeTruthy();

    act(() => {
      listeners.get('keydown')({ key: 'Escape' });
    });

    expect(queryByTestId('kpi-bubble')).toBeNull();
  });

  test('abrir la guía cierra el bubble', () => {
    const onHelp = jest.fn();
    const { getByTestId, queryByTestId } = renderTooltip({ onHelp });

    fireEvent.press(getByTestId('kpi-trigger'));
    fireEvent.press(getByTestId('kpi-bubble-help'));

    expect(onHelp).toHaveBeenCalledTimes(1);
    expect(queryByTestId('kpi-bubble')).toBeNull();
  });
});

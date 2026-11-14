import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

// eslint-disable-next-line import/first -- el mock de arriba tiene que registrarse antes del componente.
import { KpiTooltip } from '../components/dashboard/kpi-tooltip.jsx';

// El tooltip abre con tap y muestra el bloque "Qué mide" separado de la
// fórmula. Es el contrato que hace legible un KPI: la definición en lenguaje
// llano primero, el cálculo del backend después.
function renderTooltip(props = {}) {
  return render(
    <KpiTooltip id="kpi" {...props}>
      <Text nativeID="kpi-child" testID="kpi-child">12,4 km/h</Text>
    </KpiTooltip>,
  );
}

describe('KpiTooltip — definición y fórmula', () => {
  test('muestra la definición y la fórmula en bloques separados', () => {
    const { getByTestId } = renderTooltip({
      definition: 'Tu ritmo de carrera en el período.',
      formula: 'Σ(distancia × velocidad) ÷ Σ(distancia).',
    });

    fireEvent.press(getByTestId('kpi-trigger'));

    expect(getByTestId('kpi-bubble-definition-label').props.children).toBe('Qué mide');
    expect(getByTestId('kpi-bubble-definition').props.children).toBe('Tu ritmo de carrera en el período.');
    expect(getByTestId('kpi-bubble-formula-label').props.children).toBe('Cómo se calcula');
    expect(getByTestId('kpi-bubble-formula').props.children).toBe('Σ(distancia × velocidad) ÷ Σ(distancia).');
  });

  test('sin fórmula, el hint se muestra como definición (Velocidad esperada)', () => {
    const { getByTestId, queryByTestId } = renderTooltip({
      hint: 'Es la velocidad objetivo cargada en el plan, no un resultado.',
    });

    fireEvent.press(getByTestId('kpi-trigger'));

    expect(getByTestId('kpi-bubble-definition').props.children)
      .toBe('Es la velocidad objetivo cargada en el plan, no un resultado.');
    expect(queryByTestId('kpi-bubble-formula')).toBeNull();
  });

  test('con bubbleContent propio no agrega el hint como definición', () => {
    const { getByTestId, queryByTestId } = renderTooltip({
      hint: 'Más información',
      bubbleContent: <Text nativeID="kpi-extra" testID="kpi-extra">Contenido propio</Text>,
    });

    fireEvent.press(getByTestId('kpi-trigger'));

    expect(getByTestId('kpi-extra')).toBeTruthy();
    expect(queryByTestId('kpi-bubble-definition')).toBeNull();
  });

  test('con onHelp muestra el link "Más información" y lo dispara', () => {
    const onHelp = jest.fn();
    const { getByTestId } = renderTooltip({
      definition: 'Tu ritmo de carrera en el período.',
      onHelp,
    });

    fireEvent.press(getByTestId('kpi-trigger'));

    expect(getByTestId('kpi-bubble-help-label').props.children).toBe('Más información');
    fireEvent.press(getByTestId('kpi-bubble-help'));
    expect(onHelp).toHaveBeenCalledTimes(1);
  });

  test('sin onHelp no muestra el link de ayuda', () => {
    const { getByTestId, queryByTestId } = renderTooltip({
      definition: 'Tu ritmo de carrera en el período.',
    });

    fireEvent.press(getByTestId('kpi-trigger'));

    expect(queryByTestId('kpi-bubble-help')).toBeNull();
  });

  test('por defecto el disparador es el botón "i" y no toda la tarjeta', () => {
    const { getByTestId, queryByTestId } = renderTooltip({
      definition: 'Tu ritmo de carrera en el período.',
    });

    // Tocar el contenido de la tarjeta ya no abre nada.
    fireEvent.press(getByTestId('kpi-child'));
    expect(queryByTestId('kpi-bubble')).toBeNull();

    // El botón "i" sí.
    fireEvent.press(getByTestId('kpi-trigger'));
    expect(getByTestId('kpi-bubble')).toBeTruthy();
  });

  test('con trigger="card" toda la tarjeta sigue abriendo el bubble', () => {
    const { getByTestId } = renderTooltip({
      definition: 'Es la velocidad objetivo cargada en el plan.',
      trigger: 'card',
    });

    fireEvent.press(getByTestId('kpi-child'));
    expect(getByTestId('kpi-bubble')).toBeTruthy();
  });

  test('abrir un tooltip cierra el que estaba abierto', () => {
    const { getByTestId, queryByTestId } = render(
      <>
        <KpiTooltip definition="Primera métrica." id="a">
          <Text nativeID="a-child" testID="a-child">1</Text>
        </KpiTooltip>
        <KpiTooltip definition="Segunda métrica." id="b">
          <Text nativeID="b-child" testID="b-child">2</Text>
        </KpiTooltip>
      </>,
    );

    fireEvent.press(getByTestId('a-trigger'));
    expect(getByTestId('a-bubble')).toBeTruthy();

    fireEvent.press(getByTestId('b-trigger'));

    expect(getByTestId('b-bubble')).toBeTruthy();
    expect(queryByTestId('a-bubble')).toBeNull();
  });
});

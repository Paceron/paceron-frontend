import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('../theme/colors.js', () => ({
  useThemeColors: () => ({ primary: '#8cc63e', onSurfaceVariant: '#40484c' }),
}));

// eslint-disable-next-line import/first -- los mocks de arriba tienen que registrarse antes del componente.
import { MetricHelpSheet } from '../components/dashboard/metric-help-sheet.jsx';

// La ventana de ayuda tiene que abrir con su métrica, mostrar tablas y cerrarse
// por los dos caminos que ofrece. El contenido es del catálogo; acá se verifica
// que el renderer lo ponga en pantalla y que el prefijo de ids se respete.
describe('MetricHelpSheet', () => {
  test('sin métrica no monta el modal', () => {
    const { queryByTestId } = render(<MetricHelpSheet metricId={null} onClose={() => {}} />);

    expect(queryByTestId('metric-help-modal')).toBeNull();
  });

  test('un id desconocido tampoco abre la ventana', () => {
    const { queryByTestId } = render(<MetricHelpSheet metricId="no_existe" onClose={() => {}} />);

    expect(queryByTestId('metric-help-modal')).toBeNull();
  });

  test('muestra título, resumen y la tabla del ejemplo', () => {
    const { getByTestId } = render(
      <MetricHelpSheet metricId="achieved_speed_kph" onClose={() => {}} />,
    );

    expect(getByTestId('metric-help-modal')).toBeTruthy();
    expect(getByTestId('metric-help-title').props.children).toBe('Ritmo promedio / velocidad promedio');
    expect(getByTestId('metric-help-summary')).toBeTruthy();
    // Sección 1 = tabla de equivalencias km/h ↔ min/km.
    expect(getByTestId('metric-help-section-1-table')).toBeTruthy();
    expect(getByTestId('metric-help-section-1-row-1-cell-1').props.children).toBe('6:00 min/km');
    expect(getByTestId('metric-help-scroll')).toBeTruthy();
  });

  test('renderiza la fórmula como bloque propio', () => {
    const { getByTestId } = render(<MetricHelpSheet metricId="delta" onClose={() => {}} />);

    expect(getByTestId('metric-help-section-1-text').props.children)
      .toBe('Delta % = (ritmo logrado − ritmo esperado) ÷ ritmo esperado × 100');
  });

  test('cierra con la X y con el fondo', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<MetricHelpSheet metricId="delta" onClose={onClose} />);

    fireEvent.press(getByTestId('metric-help-close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('metric-help-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test('el prefijo de ids permite montar más de una ventana', () => {
    const { getByTestId } = render(
      <MetricHelpSheet id="runner-kpis-metric-help" metricId="best_time_ms" onClose={() => {}} />,
    );

    expect(getByTestId('runner-kpis-metric-help-title').props.children).toBe('Mejor tiempo');
  });
});

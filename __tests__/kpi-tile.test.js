import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

// eslint-disable-next-line import/first -- Register the icon mock before importing KpiTile.
import { KpiTile } from '../components/dashboard/kpi-tile.jsx';

describe('KpiTile — mejor tiempo cumplido', () => {
  test('muestra el delta preformateado una sola vez, como cifra principal', () => {
    const { getByTestId, queryByTestId } = render(
      <KpiTile
        centerValue
        formattedValue="+2,1 %"
        id="delta"
        label="Delta contra objetivo"
        largeValue
        unit="%"
        value={2.1}
      />,
    );

    expect(getByTestId('delta-value')).toHaveTextContent('+2,1 %');
    expect(queryByTestId('delta-delta')).toBeNull();
  });

  test('muestra la procedencia del tiempo debajo del valor', () => {
    const { getByTestId, getByText } = render(
      <KpiTile
        id="best-time"
        label="Mejor tiempo cumplido"
        source="100 mts planos · 28/09/2026"
        unit="ms"
        value={12700}
      />,
    );

    expect(getByTestId('best-time-source')).toBeTruthy();
    expect(getByText('100 mts planos · 28/09/2026')).toBeTruthy();
  });

  test('un tiempo 0 se muestra como «—» y no como un dato roto', () => {
    const { getByTestId, queryByTestId } = render(
      <KpiTile id="best-time" label="Mejor tiempo cumplido" unit="ms" value={0} />,
    );

    expect(getByTestId('best-time-value')).toHaveTextContent('—');
    expect(queryByTestId('best-time-source')).toBeNull();
  });
});

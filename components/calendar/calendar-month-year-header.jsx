import { useMemo } from 'react';
import { View } from 'react-native';
import { LocaleConfig } from 'react-native-calendars';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';

const YEARS_BACK = 2;
const YEARS_FORWARD = 3;

// Reemplaza el título de texto ("Octubre 2026") del header de
// react-native-calendars (prop customHeaderTitle) por 2 selects — las
// flechas +/-1 mes del header original se mantienen intactas, siguen
// disparando onMonthChange como siempre. Salto directo de mes/año además
// de navegación de a uno.
export function CalendarMonthYearHeader({ year, month, onChange, idPrefix }) {
  const monthOptions = useMemo(
    () => LocaleConfig.locales.es.monthNames.map((name, i) => ({ id: String(i + 1), name })),
    [],
  );
  const yearOptions = useMemo(() => {
    const nowYear = new Date().getFullYear();
    const years = [];
    for (let y = nowYear - YEARS_BACK; y <= nowYear + YEARS_FORWARD; y++) years.push({ id: String(y), name: String(y) });
    if (!years.some((y) => y.id === String(year))) years.unshift({ id: String(year), name: String(year) });
    return years;
  }, [year]);

  return (
    <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-month-year-header`} testID={`${idPrefix}-month-year-header`}>
      <ResponsiveSelectField
        className="mb-0"
        hideErrorRow
        hideLabel
        label="Mes"
        onChange={(v) => onChange(year, Number(v))}
        options={monthOptions}
        plain
        required
        value={String(month)}
      />
      <ResponsiveSelectField
        className="mb-0"
        hideErrorRow
        hideLabel
        label="Año"
        onChange={(v) => onChange(Number(v), month)}
        options={yearOptions}
        plain
        required
        value={String(year)}
      />
    </View>
  );
}

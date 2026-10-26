import { useTrainingsHistoryFiltersStore } from '../store/trainings-history-filters-store.js';

describe('trainings-history-filters-store — orden', () => {
  beforeEach(() => useTrainingsHistoryFiltersStore.setState({ order: 'desc' }));

  test('toggleOrder alterna entre desc y asc', () => {
    const { toggleOrder } = useTrainingsHistoryFiltersStore.getState();
    toggleOrder();
    expect(useTrainingsHistoryFiltersStore.getState().order).toBe('asc');
    toggleOrder();
    expect(useTrainingsHistoryFiltersStore.getState().order).toBe('desc');
  });

  // Regresión: el botón del historial le pasaba un updater `(o) => ...` a
  // setOrder, que lo guardaba tal cual. El orden quedaba en una función, la
  // etiqueta trababa en "Más antiguas primero" y la lista no se reordenaba.
  test('setOrder ignora valores que no son asc ni desc', () => {
    const { setOrder } = useTrainingsHistoryFiltersStore.getState();
    setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    expect(useTrainingsHistoryFiltersStore.getState().order).toBe('desc');
    setOrder('asc');
    expect(useTrainingsHistoryFiltersStore.getState().order).toBe('asc');
  });
});

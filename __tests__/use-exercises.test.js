// Importar hooks/use-exercises.js arrastra services/exercises.js ->
// services/api.js -> store/auth-store.js -> services/storage.js, que en
// el branch nativo hace require('expo-secure-store') (ESM, no
// transformable por Jest) — se mockea igual que en auth-store.test.js
// para poder testear las 2 constantes puras del archivo.
jest.mock('../services/storage.js', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));
jest.mock('../providers/theme-provider.jsx', () => ({
  seedDefaultTheme: jest.fn(),
}));
jest.mock('../lib/query-client.js', () => ({
  queryClient: { clear: jest.fn(), setQueryData: jest.fn(), invalidateQueries: jest.fn() },
}));

import { EXERCISE_KIND_OPTIONS, MUSCLE_GROUP_OPTIONS } from '../hooks/use-exercises.js';

describe('EXERCISE_KIND_OPTIONS', () => {
  test('cubre los 5 tipos hoja', () => {
    expect(EXERCISE_KIND_OPTIONS.map((o) => o.id).sort()).toEqual(['cruising', 'elongation', 'jogging', 'running', 'walking']);
  });
});

describe('MUSCLE_GROUP_OPTIONS', () => {
  test('no está vacío', () => {
    expect(MUSCLE_GROUP_OPTIONS.length).toBeGreaterThan(0);
  });
});

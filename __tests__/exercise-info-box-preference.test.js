import { readInfoBoxDismissed, writeInfoBoxDismissed } from '../utils/exercise-info-box-preference';

// La clave NO está exportada desde el módulo (mismo criterio que
// `paceron-theme-mode` en providers/theme-provider.jsx, que tampoco la exporta):
// si un test la importara, el contrato de la clave quedaría testeado contra el
// mismo valor que define la implementación — que no verifica nada.
jest.mock('../services/storage.js', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

const { getItem, setItem } = jest.requireMock('../services/storage.js');

beforeEach(() => {
  getItem.mockReset();
  setItem.mockReset();
});

describe('readInfoBoxDismissed', () => {
  it('true cuando la preferencia guardada es "true"', async () => {
    getItem.mockResolvedValue('true');
    await expect(readInfoBoxDismissed()).resolves.toBe(true);
  });

  it('false cuando la preferencia guardada es "false" (el usuario lo volvió a mostrar)', async () => {
    getItem.mockResolvedValue('false');
    await expect(readInfoBoxDismissed()).resolves.toBe(false);
  });

  it('false si nunca se guardó nada (default: se muestra)', async () => {
    getItem.mockResolvedValue(null);
    await expect(readInfoBoxDismissed()).resolves.toBe(false);
  });

  it('false si el storage tira — no rompe el form', async () => {
    getItem.mockRejectedValue(new Error('cuota llena'));
    await expect(readInfoBoxDismissed()).resolves.toBe(false);
  });

  it('false ante cualquier valor raro guardado (no confunde undefined con true)', async () => {
    for (const weird of [undefined, '', '1', 'TRUE', 'null']) {
      getItem.mockResolvedValue(weird);
      await expect(readInfoBoxDismissed()).resolves.toBe(false);
    }
  });
});

describe('writeInfoBoxDismissed', () => {
  it('guarda "true" al marcar "no volver a mostrar"', async () => {
    await writeInfoBoxDismissed(true);
    expect(setItem).toHaveBeenCalledWith(expect.any(String), 'true');
  });

  it('guarda "false" al volver a mostrarlo', async () => {
    await writeInfoBoxDismissed(false);
    expect(setItem).toHaveBeenCalledWith(expect.any(String), 'false');
  });

  it('no propaga el error si el storage falla (fallback en memoria)', async () => {
    setItem.mockRejectedValue(new Error('modo privado'));
    await expect(writeInfoBoxDismissed(true)).resolves.toBeUndefined();
  });

  it('usa siempre la misma clave (una sola preferencia, no se pisa)', async () => {
    await writeInfoBoxDismissed(true);
    const firstKey = setItem.mock.calls[0][0];
    await writeInfoBoxDismissed(false);
    expect(setItem.mock.calls[1][0]).toBe(firstKey);
  });

  it('la clave usa el prefijo paceron. como el resto del storage', async () => {
    await writeInfoBoxDismissed(true);
    expect(setItem.mock.calls[0][0]).toMatch(/^paceron\./);
  });
});

describe('round-trip', () => {
  it('leer después de escribir devuelve lo mismo', async () => {
    const store = {};
    setItem.mockImplementation(async (k, v) => { store[k] = v; });
    getItem.mockImplementation(async (k) => store[k] ?? null);

    await writeInfoBoxDismissed(true);
    await expect(readInfoBoxDismissed()).resolves.toBe(true);

    await writeInfoBoxDismissed(false);
    await expect(readInfoBoxDismissed()).resolves.toBe(false);
  });
});

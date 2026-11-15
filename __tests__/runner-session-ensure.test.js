import { createRunnerSessionEnsurer } from '../utils/runner-session-ensure.js';

describe('createRunnerSessionEnsurer', () => {
  test('crea una sola vez aunque se llame varias veces', async () => {
    const create = jest.fn().mockResolvedValue({ id: 1 });
    const ensure = createRunnerSessionEnsurer(create);

    await ensure();
    await ensure();
    await ensure();

    expect(create).toHaveBeenCalledTimes(1);
  });

  test('comparte la misma promesa entre llamadas concurrentes', async () => {
    let resolveCreate;
    const create = jest.fn(() => new Promise((resolve) => { resolveCreate = resolve; }));
    const ensure = createRunnerSessionEnsurer(create);

    const first = ensure();
    const second = ensure();
    resolveCreate({ id: 1 });

    await expect(first).resolves.toEqual({ id: 1 });
    await expect(second).resolves.toEqual({ id: 1 });
    expect(create).toHaveBeenCalledTimes(1);
  });

  test('permite reintentar despues de un fallo', async () => {
    const create = jest.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ id: 2 });
    const ensure = createRunnerSessionEnsurer(create);

    await expect(ensure()).rejects.toThrow('offline');
    await expect(ensure()).resolves.toEqual({ id: 2 });
    expect(create).toHaveBeenCalledTimes(2);
  });
});

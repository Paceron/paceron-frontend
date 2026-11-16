import { resolveCompetitionCreatorName } from '../utils/competition-creator.js';

describe('resolveCompetitionCreatorName', () => {
  test('resuelve al dueño del equipo por ownerName', () => {
    expect(resolveCompetitionCreatorName({
      competition: { createdByUserId: '1', createdByRole: 'trainer' },
      ownerId: 1,
      ownerName: 'Ana Pérez',
    })).toBe('Ana Pérez');
  });

  test('resuelve a un corredor del roster', () => {
    expect(resolveCompetitionCreatorName({
      competition: { createdByUserId: '101', createdByRole: 'runner' },
      members: [{ userId: '101', name: 'Lucía Fernández' }],
    })).toBe('Lucía Fernández');
  });

  test('cae al rol cuando no hay nombre disponible', () => {
    expect(resolveCompetitionCreatorName({
      competition: { createdByUserId: '1', createdByRole: 'trainer' },
      ownerId: 1,
    })).toBe('Entrenador');
  });

  test('devuelve null sin creador', () => {
    expect(resolveCompetitionCreatorName({ competition: {} })).toBeNull();
  });
});

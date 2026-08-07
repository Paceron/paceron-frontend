import { mockSearchUsers } from '../services/__mocks__/user-mock.js';

describe('mockSearchUsers', () => {
  test('returns no results for queries shorter than 3 characters', async () => {
    const res = await mockSearchUsers('lu');
    expect(res.results).toEqual([]);
  });

  test('matches by partial name, surname, or email, case-insensitive', async () => {
    const byName = await mockSearchUsers('luc');
    expect(byName.results).toEqual(expect.arrayContaining([expect.objectContaining({ email: 'lucia.fernandez@mail.com' })]));

    const bySurname = await mockSearchUsers('GOMEZ');
    expect(bySurname.results).toEqual(expect.arrayContaining([expect.objectContaining({ email: 'martin.gomez@mail.com' })]));

    const byEmail = await mockSearchUsers('sofia.rodriguez');
    expect(byEmail.results).toEqual(expect.arrayContaining([expect.objectContaining({ user_id: 103 })]));
  });

  test('returns an empty array when nothing matches', async () => {
    const res = await mockSearchUsers('xyzxyz');
    expect(res.results).toEqual([]);
  });
});

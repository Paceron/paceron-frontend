import { mockSearchUsers, mockBatchLookupUsers } from '../services/__mocks__/user-mock.js';

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

describe('mockBatchLookupUsers', () => {
  test('resolves known ids from the catalog', async () => {
    const res = await mockBatchLookupUsers([101, 102]);
    expect(res.results).toEqual([
      expect.objectContaining({ user_id: 101, email: 'lucia.fernandez@mail.com' }),
      expect.objectContaining({ user_id: 102, email: 'martin.gomez@mail.com' }),
    ]);
  });

  test('falls back to a generic placeholder for unknown ids', async () => {
    const res = await mockBatchLookupUsers([9999]);
    expect(res.results).toEqual([expect.objectContaining({ user_id: 9999 })]);
  });

  test('returns one result per id, in order', async () => {
    const res = await mockBatchLookupUsers([102, 101]);
    expect(res.results.map((u) => u.user_id)).toEqual([102, 101]);
  });
});

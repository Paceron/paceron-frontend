import { deriveRecipients } from '../utils/session-message-recipients.js';

describe('deriveRecipients', () => {
  test('allSelected -> all, lista vacía', () => {
    expect(deriveRecipients({ allSelected: true, selectedUserIds: new Set(['1', '2']) }))
      .toEqual({ recipientMode: 'all', recipientUserIds: [] });
  });

  test('un solo seleccionado -> direct', () => {
    expect(deriveRecipients({ allSelected: false, selectedUserIds: new Set(['7']) }))
      .toEqual({ recipientMode: 'direct', recipientUserIds: ['7'] });
  });

  test('dos o más seleccionados -> multiple', () => {
    const result = deriveRecipients({ allSelected: false, selectedUserIds: new Set(['7', '8']) });
    expect(result.recipientMode).toBe('multiple');
    expect(result.recipientUserIds.sort()).toEqual(['7', '8']);
  });

  test('ninguno seleccionado y no es Todos -> null', () => {
    expect(deriveRecipients({ allSelected: false, selectedUserIds: new Set() })).toBeNull();
  });
});

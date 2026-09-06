jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

describe('fuera de mobile (web)', () => {
  jest.mock('../utils/platform.js', () => ({ isMobile: false }));

  test('notifySuccess no llama a Haptics', () => {
    const Haptics = require('expo-haptics');
    const { notifySuccess } = require('../utils/haptics.js');
    notifySuccess();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});

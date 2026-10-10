jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
  ImpactFeedbackStyle: { Medium: 'medium', Heavy: 'heavy' },
}));

describe('fuera de mobile (web)', () => {
  jest.mock('../utils/platform.js', () => ({ isMobile: false }));

  test('notifySuccess no llama a Haptics', () => {
    const Haptics = require('expo-haptics');
    const { notifySuccess } = require('../utils/haptics.js');
    notifySuccess();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  test('notifyAviso no llama a Haptics', () => {
    const Haptics = require('expo-haptics');
    const { notifyAviso } = require('../utils/haptics.js');
    notifyAviso();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  test('notifyAlerta no llama a Haptics', () => {
    const Haptics = require('expo-haptics');
    const { notifyAlerta } = require('../utils/haptics.js');
    notifyAlerta();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});

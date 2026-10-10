jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
  ImpactFeedbackStyle: { Medium: 'medium', Heavy: 'heavy' },
}));

describe('en mobile', () => {
  jest.mock('../utils/platform.js', () => ({ isMobile: true }));

  test('notifySuccess dispara notificationAsync con Success', async () => {
    const Haptics = require('expo-haptics');
    const { notifySuccess } = require('../utils/haptics.js');
    notifySuccess();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });

  test('notifyAviso dispara impactAsync con Medium', async () => {
    const Haptics = require('expo-haptics');
    const { notifyAviso } = require('../utils/haptics.js');
    notifyAviso();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  test('notifyAlerta dispara impactAsync con Heavy', async () => {
    const Haptics = require('expo-haptics');
    const { notifyAlerta } = require('../utils/haptics.js');
    notifyAlerta();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });
});

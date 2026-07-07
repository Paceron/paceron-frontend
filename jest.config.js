module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo(nent)?|expo-modules-core|@expo|expo-router|nativewind|react-native-worklets)/)',
  ],
};

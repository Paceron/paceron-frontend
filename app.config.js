// app.config.js dinámico: permite variantes dev/production (nombre, ícono,
// android.package, color de fondo del adaptive icon) desde el mismo código.
// APP_VARIANT lo setean los profiles de eas.json (env), no depende de nada
// implícito del entorno de build.
const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = {
  expo: {
    name: IS_DEV ? 'Paceron Dev' : 'Paceron',
    slug: 'paceron-frontend',
    version: '1.0.0',
    orientation: 'portrait',
    icon: IS_DEV ? './assets/icon-dev.png' : './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    runtimeVersion: {
      policy: 'fingerprint',
    },
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      package: IS_DEV ? 'com.paceron.app.dev' : 'com.paceron.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        // Mismo foreground en ambas variantes; el fondo distinto (ámbar vs
        // blanco) es lo que diferencia visualmente dev de producción.
        backgroundColor: IS_DEV ? '#f59e0b' : '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
      output: 'static',
    },
    experiments: {
      typedRoutes: true,
    },
    plugins: [
      ['expo-router', { sitemap: false }],
      ['expo-location', { locationAlwaysAndWhenInUsePermission: 'Allow Paceron to use your location for tracking runs.' }],
      'expo-font',
      'expo-secure-store',
    ],
    extra: {
      eas: {
        projectId: '98d5ecd7-7b77-4818-8621-a7d4386442bd',
      },
    },
    updates: {
      url: 'https://u.expo.dev/98d5ecd7-7b77-4818-8621-a7d4386442bd',
    },
  },
};

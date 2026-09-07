// app.config.js dinámico: permite variantes dev/production (nombre, ícono,
// android.package, color de fondo del adaptive icon) desde el mismo código.
// APP_VARIANT lo setean los profiles de eas.json (env), no depende de nada
// implícito del entorno de build.
const IS_DEV = process.env.APP_VARIANT === 'development';
const { version } = require('./package.json');

module.exports = {
  expo: {
    name: IS_DEV ? 'Paceron Dev' : 'Paceron',
    slug: 'paceron-frontend',
    // Distinto de dev/prod, igual que android.package — evita que ambas
    // variantes instaladas a la vez en un mismo device compitan por el
    // mismo esquema de deep link.
    scheme: IS_DEV ? 'paceron-dev' : 'paceron',
    // Toma la versión de package.json — evitar un segundo lugar donde
    // bumpear a mano (quedó pisado en 1.0.0 desde el bootstrap inicial,
    // sin sincronizarse nunca con el versionado incremental real).
    version,
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
      // Dos apps Android en el mismo proyecto Firebase (paceron-4b46c) —
      // misma service account/clave FCM V1 para ambas (está scopeada al
      // proyecto, no a la app), pero cada variante necesita su propio
      // google-services.json (distinto api_key/mobilesdk_app_id por package).
      googleServicesFile: IS_DEV ? './google-services.dev.json' : './google-services.production.json',
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
      favicon: './assets/paceron-symbol-transparent.png',
      bundler: 'metro',
      output: 'static',
    },
    experiments: {
      typedRoutes: true,
    },
    plugins: [
      ['expo-router', { sitemap: false }],
      ['expo-location', { locationAlwaysAndWhenInUsePermission: 'Allow Paceron to use your location for tracking runs.' }],
      ['expo-image-picker', { photosPermission: 'Allow Paceron to access your photos to set a team profile picture.' }],
      'expo-font',
      'expo-secure-store',
      '@react-native-community/datetimepicker',
      'expo-notifications',
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

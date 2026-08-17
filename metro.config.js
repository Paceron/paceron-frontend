const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = withNativeWind(getDefaultConfig(__dirname), { input: './nativewind.css' });

// Habilita `import contenido from './archivo.md'` (ver metro-markdown-transformer.js).
config.resolver.sourceExts = [...config.resolver.sourceExts, 'md'];
config.transformer.babelTransformerPath = require.resolve('./metro-markdown-transformer.js');

module.exports = config;

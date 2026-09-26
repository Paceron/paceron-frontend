const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = withNativeWind(getDefaultConfig(__dirname), { input: './nativewind.css' });

// Habilita `import contenido from './archivo.md'` (ver metro-markdown-transformer.js).
config.resolver.sourceExts = [...config.resolver.sourceExts, 'md'];
config.transformer.babelTransformerPath = require.resolve('./metro-markdown-transformer.js');

// `wasm` en assetExts: sin esto el bundle web no resuelve el
// `expo-sqlite/web/worker.ts` que hace `import wasmModule from
// './wa-sqlite/wa-sqlite.wasm'` — Metro no conoce la extensión, tira
// "Unable to resolve module" y el bundle entero falla. El archivo está en
// disco, es solo que el resolver nunca lo busca. Documentado en
// https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/#web-setup
//
// Lo que la doc pide TAMBIÉN y acá NO se agrega a propósito: los headers
// Cross-Origin-Opener-Policy/Embedder-Policy (vía `server.enhanceMiddleware`),
// que son lo que habilita SharedArrayBuffer y por lo tanto SQLite en web.
// Razón: `COOP: same-origin` pone la ventana emergente en otro browsing
// context group, lo que rompe `window.opener` — y de eso vive el retorno del
// OAuth de Mercado Pago en web (components/payments/mp-connect-button.web.jsx
// + mp-connect-callback-page.jsx). Perdería el canal de `postMessage` de una
// funcionalidad que sí se usa en web, a cambio de habilitar algo que acá no se
// usa: el módulo de sesión en vivo es mobile-only (MobileOnlyGate), nunca
// llama SQLite en web. Si alguna vez SQLite se necesita en web, agregar los
// headers junto con un plan para el popup de MP (ej. un callback en el server
// que reenvíe el estado, o volver a polling como canal único).
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

module.exports = config;

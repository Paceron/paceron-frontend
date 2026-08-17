// Permite importar archivos .md como string desde el código de la app.
//
// Metro no resuelve .md de fábrica (no está ni en sourceExts ni en
// assetExts). Este wrapper delega todo al transformer de Expo, salvo los
// .md, que convierte en un módulo JS que exporta el contenido como string.
//
// NativeWind no ocupa el slot de babelTransformerPath (lo deja en el de
// Expo), así que encadenarlo acá no entra en conflicto.
const upstream = require('@expo/metro-config/build/babel-transformer.js');

// JSON.stringify se encarga del escapado de comillas, backslashes y
// saltos de línea. No usar template literals: un backtick en el contrato
// rompería el módulo generado.
function wrapMarkdown(src) {
  return `module.exports = ${JSON.stringify(src)};`;
}

function transform({ src, filename, ...rest }) {
  if (filename.endsWith('.md')) {
    return upstream.transform({ src: wrapMarkdown(src), filename, ...rest });
  }
  return upstream.transform({ src, filename, ...rest });
}

module.exports = { transform, wrapMarkdown };

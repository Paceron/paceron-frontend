import { ScrollViewStyleReset } from 'expo-router/html';

// Script sincrónico: corre ANTES de que el browser pinte nada y antes de que
// cargue el bundle de React. Lee la preferencia de tema persistida y aplica
// la clase 'dark' de una — evita el flash de tema claro antes de oscuro que
// ocurre si esa clase se agrega recién en un useEffect (post-paint).
// Misma lógica/default que readInitialThemeMode() en providers/theme-provider.jsx.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var mode = localStorage.getItem('paceron-theme-mode');
    if (mode !== 'light') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function Root({ children }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

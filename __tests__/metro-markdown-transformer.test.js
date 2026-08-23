const { wrapMarkdown } = require('../metro-markdown-transformer.js');

// Evalúa el módulo generado y devuelve lo que exporta, que debe ser
// exactamente el markdown original.
function evalWrapped(src) {
  const module = { exports: null };
  // eslint-disable-next-line no-new-func
  new Function('module', wrapMarkdown(src))(module);
  return module.exports;
}

describe('wrapMarkdown', () => {
  test('genera un módulo que exporta el contenido tal cual', () => {
    expect(evalWrapped('# Hola')).toBe('# Hola');
  });

  test('preserva saltos de línea', () => {
    expect(evalWrapped('# Titulo\n\nParrafo')).toBe('# Titulo\n\nParrafo');
  });

  test('preserva comillas dobles y simples', () => {
    const src = 'El "usuario" acepta los \'terminos\'';
    expect(evalWrapped(src)).toBe(src);
  });

  test('preserva backticks y backslashes', () => {
    const src = 'Ruta C:\\datos y `codigo` inline';
    expect(evalWrapped(src)).toBe(src);
  });

  test('preserva acentos y ñ', () => {
    const src = '# Términos y Condiciones\n\nSección de privacidad.';
    expect(evalWrapped(src)).toBe(src);
  });

  test('soporta contenido vacío', () => {
    expect(evalWrapped('')).toBe('');
  });
});

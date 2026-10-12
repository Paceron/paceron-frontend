// Helpers puros de entrada numérica del form de ejercicios. Viven acá y no en
// el JSX para poder testearlos: el proyecto no hace render de componentes, así
// que una función con reglas (decimales, piso en 0, NaN) que quede en el
// componente directamente no tiene ninguna cobertura.

// Deja pasar solo dígitos y un único punto decimal. `keyboardType` solo cambia
// el teclado virtual en mobile — no restringe lo que se puede tipear con teclado
// físico ni en web, donde el input es un <input type="text">.
export function sanitizeNumericInput(text) {
  const cleaned = String(text).replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, '')}`;
}

// Stepper de +1 / −1. El campo puede traer decimales ("2.5"), así que se
// preserva la parte decimal al sumar y solo se limpia si el resultado da entero.
// No baja de 0: un negativo no tiene sentido en distancia ni tiempo, y el
// validator lo rechazaría igual — mejor no ofrecer el estado.
// Devuelve siempre string, porque el input está controlado por string.
export function stepNumeric(current, delta) {
  const parsed = current === '' || current == null ? 0 : Number(current);
  const base = Number.isFinite(parsed) ? parsed : 0;
  const next = base + delta;
  if (next <= 0) return '0';
  return Number.isInteger(next) ? String(next) : String(parseFloat(next.toFixed(2)));
}

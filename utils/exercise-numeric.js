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

// Stepper de la velocidad, que a diferencia de tiempo y distancia sí tiene
// decimales con significado (10.4 vs 10.6 es una diferencia real de ritmo).
//
// Regla: el paso depende de DÓNDE está el cursor.
//  - Cursor sobre la parte decimal (o selección que la cubre) → se mueve el
//    último dígito decimal, 10.4 → 10.5. Si desborda, arrastra a la entera:
//    10.9 → 11.0.
//  - Cursor sobre la entera, o sin selección (campo recién enfocado, o
//    focus que nadie tocó) → se mueve la entera: 10.4 → 11.4.
//
// `selectionStart` es el `selection.start` que reporta el TextInput. Es
// opcional a propósito: si el caller no lo pasa, el comportamiento es el de
// la entera, que es el caso por defecto cuando nadie posicionó el cursor.
export function stepSpeed(current, delta, selectionStart = null) {
  const value = current === '' || current == null ? '0' : String(current);
  const dotIndex = value.indexOf('.');
  // Mínimo 1 decimal si HAY punto: el usuario puede tener "0." a medio teclear
  // (sanitizeNumericInput lo deja pasar) y en ese caso el paso tiene que ser
  // 0.1, no 1 — si no, tocar +1 salta de "0." a "1" y lo descoloca.
  const decimals = dotIndex === -1 ? 0 : Math.max(1, value.length - dotIndex - 1);

  const parsed = Number(value);
  const base = Number.isFinite(parsed) ? parsed : 0;

  const inDecimals = dotIndex !== -1 && selectionStart != null && selectionStart > dotIndex;
  const unit = inDecimals ? 1 / 10 ** decimals : 1;

  const next = base + delta * unit;
  if (next <= 0) return '0';

  // Se conservan los decimales que tenía: si el usuario escribió "10.50", el
  // resultado sigue con 2 decimales — no queremos convertir 10.50 en 10.5 y
  // cambiarle el formato bajo los pies mientras edita.
  if (decimals > 0) return next.toFixed(decimals);
  return String(Math.round(next));
}

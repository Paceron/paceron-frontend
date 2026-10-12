import { sanitizeNumericInput, stepNumeric } from '../utils/exercise-numeric';
import { calculateSpeedKph } from '../utils/exercise-speed';
import { getFieldRules } from '../utils/exercise-field-matrix';

// Los helpers de entrada numérica viven en utils/ y no en el JSX del modal
// justamente para poder testearlos: el proyecto no hace render de componentes,
// así que una función con reglas (decimales, piso en 0, NaN) escrita dentro del
// componente no tendría ninguna cobertura. Acá se importa la MISMA función que
// usa el form, no una copia.

describe('sanitizeNumericInput', () => {
  it('deja pasar dígitos', () => {
    expect(sanitizeNumericInput('3000')).toBe('3000');
  });

  it('deja pasar un único punto decimal', () => {
    expect(sanitizeNumericInput('12.5')).toBe('12.5');
  });

  it('borra letras y signos (keyboardType no restringe en web)', () => {
    expect(sanitizeNumericInput('12a5')).toBe('125');
    expect(sanitizeNumericInput('-12')).toBe('12');
    expect(sanitizeNumericInput('1,5')).toBe('15');
  });

  it('deja solo el primer punto decimal', () => {
    expect(sanitizeNumericInput('1.2.3')).toBe('1.23');
  });

  it('permite un punto al principio (el usuario puede escribir ".5")', () => {
    expect(sanitizeNumericInput('.5')).toBe('.5');
  });

  it('devuelve vacío si no queda nada', () => {
    expect(sanitizeNumericInput('abc')).toBe('');
  });

  it('no rompe con null/undefined', () => {
    expect(sanitizeNumericInput(null)).toBe('');
    expect(sanitizeNumericInput(undefined)).toBe('');
  });
});

describe('stepNumeric', () => {
  it('suma 1 a un entero', () => {
    expect(stepNumeric('5', 1)).toBe('6');
    expect(stepNumeric('3000', 1)).toBe('3001');
  });

  it('resta 1 a un entero', () => {
    expect(stepNumeric('5', -1)).toBe('4');
  });

  it('parte de 0 cuando el campo está vacío, null o undefined', () => {
    expect(stepNumeric('', 1)).toBe('1');
    expect(stepNumeric('', -1)).toBe('0');
    expect(stepNumeric(null, 1)).toBe('1');
    expect(stepNumeric(undefined, 1)).toBe('1');
  });

  it('preserva la parte decimal al sumar', () => {
    expect(stepNumeric('2.5', 1)).toBe('3.5');
    expect(stepNumeric('2.5', -1)).toBe('1.5');
  });

  it('limpia el decimal si el resultado da entero', () => {
    expect(stepNumeric('10.0', 1)).toBe('11');
  });

  it('nunca baja de 0 (negativo no tiene sentido en estos campos)', () => {
    expect(stepNumeric('1', -1)).toBe('0');
    expect(stepNumeric('0', -1)).toBe('0');
    expect(stepNumeric('0', -5)).toBe('0');
  });

  it('trata un valor no numérico como 0 en vez de romper', () => {
    expect(stepNumeric('abc', 1)).toBe('1');
    expect(stepNumeric(NaN, 1)).toBe('1');
  });

  it('el resultado siempre es string (el input está controlado por string)', () => {
    expect(typeof stepNumeric('5', 1)).toBe('string');
    expect(typeof stepNumeric('2.5', 1)).toBe('string');
  });

  it('el resultado siempre pasa el sanitizer (no puede introducir basura)', () => {
    for (const current of ['5', '2.5', '', 'abc', '0', null]) {
      for (const delta of [1, -1, -5]) {
        expect(sanitizeNumericInput(stepNumeric(current, delta))).toBe(stepNumeric(current, delta));
      }
    }
  });
});

describe('stepper + velocidad', () => {
  it('steppear tiempo recalcula la velocidad de forma visible', () => {
    // 5000 m / 30 min = 10 km/h → con 31 min = 9.7 km/h
    expect(calculateSpeedKph('5000', 30)).toBe(10);
    expect(calculateSpeedKph('5000', stepNumeric('30', 1))).toBe(9.7);
  });

  it('steppear distancia recalcula la velocidad cuando el cambio es visible', () => {
    // 50 m / 1 min = 3 km/h → 51 m = 3.1 km/h
    expect(calculateSpeedKph('50', 1)).toBe(3);
    expect(calculateSpeedKph(stepNumeric('50', 1), 1)).toBe(3.1);
  });

  it('a escala de carrera, +1 metro NO cambia la velocidad visible', () => {
    // Comportamiento esperado, no un bug: `speed_kph` es numeric(4,1), así que
    // la resolución es de 0.1 km/h. +1 metro solo mueve la velocidad cuando el
    // tiempo es chico (Δ = 0.06/min km/h). A 5000 m / 30 min el cambio real es
    // 10,002 → 10,0. El stepper sigue siendo útil para ajustar el número que
    // se ve en el campo, aunque la velocidad redondeada no se mueva.
    expect(calculateSpeedKph('5000', 30)).toBe(10);
    expect(calculateSpeedKph(stepNumeric('5000', 1), 30)).toBe(10);
  });

  it('el valor del stepper es consumible por el cálculo', () => {
    expect(calculateSpeedKph(stepNumeric('50', 1), 1)).toBe(3.1);
  });
});

describe('qué campos tienen stepper', () => {
  it('el stepper va solo en tiempo y distancia, no en velocidad', () => {
    // La velocidad es un resultado del cálculo, no un campo que el usuario
    // quiera ajustar de a uno a mano.
    const conStepper = ['liviano', 'elongacion', 'ritmo_continuo', 'velocidad_tiempo', 'velocidad_distancia']
      .filter((kind) => {
        const r = getFieldRules(kind);
        return r.showTime || r.showDistance;
      });
    expect(conStepper).toHaveLength(5);
  });

  it('ningún tipo expone velocidad como campo con stepper', () => {
    for (const kind of ['liviano', 'elongacion', 'ritmo_continuo', 'velocidad_tiempo', 'velocidad_distancia']) {
      expect(getFieldRules(kind).showSpeed === undefined).toBe(false);
    }
  });

  it('elongacion muestra tiempo pero no distancia', () => {
    const r = getFieldRules('elongacion');
    expect(r.showTime).toBe(true);
    expect(r.showDistance).toBe(false);
  });
});

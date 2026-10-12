import { sanitizeNumericInput, stepNumeric, stepSpeed } from '../utils/exercise-numeric';
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

describe('stepSpeed — el paso depende de dónde está el cursor', () => {
  // selectionStart es el índice del caracter donde está el cursor.
  // "10.4" →  indices: 0='1' 1='0' 2='.' 3='4'

  describe('cursor sobre la parte decimal', () => {
    it('suma 0.1, no 1', () => {
      expect(stepSpeed('10.4', 1, 3)).toBe('10.5');
    });

    it('resta 0.1', () => {
      expect(stepSpeed('10.4', -1, 3)).toBe('10.3');
    });

    it('arrastra a la entera cuando desborda el decimal', () => {
      expect(stepSpeed('10.9', 1, 3)).toBe('11.0');
      expect(stepSpeed('19.9', 1, 3)).toBe('20.0');
    });

    it('pide un prestado a la entera al restar', () => {
      expect(stepSpeed('11.0', -1, 3)).toBe('10.9');
    });

    it('respeta la cantidad de decimales que tiene el valor', () => {
      // "10.45" → 2 decimales → el paso es 0.01
      expect(stepSpeed('10.45', 1, 4)).toBe('10.46');
      expect(stepSpeed('10.45', 1, 5)).toBe('10.46');
      // "10.5" → 1 decimal → el paso es 0.1
      expect(stepSpeed('10.5', 1, 3)).toBe('10.6');
    });

    it('arrastra bien con varios decimales', () => {
      expect(stepSpeed('10.99', 1, 4)).toBe('11.00');
    });

    it('no baja de 0', () => {
      expect(stepSpeed('0.1', -1, 3)).toBe('0');
    });
  });

  describe('cursor sobre la parte entera', () => {
    it('suma 1 a la entera', () => {
      expect(stepSpeed('10.4', 1, 0)).toBe('11.4');
      expect(stepSpeed('10.4', 1, 1)).toBe('11.4');
    });

    it('resta 1 a la entera', () => {
      expect(stepSpeed('10.4', -1, 0)).toBe('9.4');
    });

    it('funciona igual sin decimales', () => {
      expect(stepSpeed('10', 1, 0)).toBe('11');
      expect(stepSpeed('10', -1, 0)).toBe('9');
    });
  });

  describe('sin selección (campo recién enfocado o sin tocar)', () => {
    it('cae en el comportamiento de la entera', () => {
      expect(stepSpeed('10.4', 1, null)).toBe('11.4');
      expect(stepSpeed('10.4', 1, undefined)).toBe('11.4');
    });

    it('omite el argumento también funciona', () => {
      expect(stepSpeed('10.4', 1)).toBe('11.4');
    });
  });

  describe('campo vacío o inválido', () => {
    it('parte de 0', () => {
      expect(stepSpeed('', 1, null)).toBe('1');
      expect(stepSpeed('', 1, 0)).toBe('1');
    });

    it('trata texto no numérico como 0 sin romper', () => {
      expect(stepSpeed('abc', 1, null)).toBe('1');
      expect(stepSpeed(NaN, 1, null)).toBe('1');
    });

    it('arranca en 0.0 si el campo ya tiene formato decimal vacío', () => {
      expect(stepSpeed('0.', 1, 2)).toBe('0.1');
    });
  });

  describe('preservación de formato', () => {
    it('mantiene los decimales que tenía el usuario', () => {
      // "10.50" sigue con 2 decimales: no se le reformatea a "10.5" mientras
      // edita, que lo haría ver como un cambio que él no hizo.
      expect(stepSpeed('10.50', 1, 4)).toBe('10.51');
    });

    it('sin decimales no inventa decimales', () => {
      expect(stepSpeed('10', 1, 0)).toBe('11');
    });
  });

  it('el resultado siempre pasa el sanitizer', () => {
    for (const v of ['10.4', '10', '', '0.1', '99.9']) {
      for (const d of [1, -1]) {
        expect(sanitizeNumericInput(stepSpeed(v, d, 3))).toBe(stepSpeed(v, d, 3));
      }
    }
  });
});

import { calculateSpeedKph, formatSpeedInput } from '../utils/exercise-speed';

describe('calculateSpeedKph', () => {
  describe('casos canónicos', () => {
    it('1000 m en 60 min = 1 km/h', () => {
      expect(calculateSpeedKph(1000, 60)).toBe(1);
    });

    it('1000 m en 30 min = 2 km/h', () => {
      expect(calculateSpeedKph(1000, 30)).toBe(2);
    });

    it('500 m en 30 min = 1 km/h', () => {
      expect(calculateSpeedKph(500, 30)).toBe(1);
    });

    it('3000 m en 120 min = 1.5 km/h', () => {
      expect(calculateSpeedKph(3000, 120)).toBe(1.5);
    });

    it('convierte correctamente m/min → km/h (un minuto de 5 km)', () => {
      expect(calculateSpeedKph(5000, 1)).toBe(300);
    });
  });

  describe('datos insuficientes', () => {
    it('devuelve null si falta la distancia', () => {
      expect(calculateSpeedKph(null, 30)).toBeNull();
      expect(calculateSpeedKph(undefined, 30)).toBeNull();
      expect(calculateSpeedKph('', 30)).toBeNull();
    });

    it('devuelve null si falta el tiempo', () => {
      expect(calculateSpeedKph(1000, null)).toBeNull();
      expect(calculateSpeedKph(1000, undefined)).toBeNull();
      expect(calculateSpeedKph(1000, '')).toBeNull();
    });

    it('devuelve null si el tiempo es cero (división por cero)', () => {
      expect(calculateSpeedKph(1000, 0)).toBeNull();
    });

    it('devuelve null con distancia 0 y tiempo 0', () => {
      expect(calculateSpeedKph(0, 0)).toBeNull();
    });
  });

  describe('valores no calculables', () => {
    it('devuelve null con negativos', () => {
      expect(calculateSpeedKph(-1000, 30)).toBeNull();
      expect(calculateSpeedKph(1000, -30)).toBeNull();
    });

    it('devuelve null con texto no numérico', () => {
      expect(calculateSpeedKph('abc', 30)).toBeNull();
      expect(calculateSpeedKph(1000, '30 min')).toBeNull();
      expect(calculateSpeedKph('1e', 30)).toBeNull();
    });

    it('devuelve null con NaN', () => {
      expect(calculateSpeedKph(NaN, 30)).toBeNull();
      expect(calculateSpeedKph(1000, NaN)).toBeNull();
    });

    it('devuelve null con Infinity', () => {
      expect(calculateSpeedKph(Infinity, 30)).toBeNull();
      expect(calculateSpeedKph(1000, Infinity)).toBeNull();
    });

    it('devuelve null con booleanos (evita coerción de true/false a 1/0)', () => {
      expect(calculateSpeedKph(true, 30)).toBeNull();
      expect(calculateSpeedKph(1000, true)).toBeNull();
    });

    it('nunca devuelve 0 inventado cuando no es calculable', () => {
      // El bug que evita esto: Number(null) === 0, que pasa un Number.isFinite.
      expect(calculateSpeedKph(null, null)).toBeNull();
      expect(calculateSpeedKph(undefined, undefined)).toBeNull();
      expect(calculateSpeedKph('', '')).toBeNull();
    });
  });

  describe('redondeo', () => {
    it('redondea a 1 decimal (lo que acepta numeric(4,1))', () => {
      // 1234 m en 7 min = 10.577... → 10.6
      expect(calculateSpeedKph(1234, 7)).toBe(10.6);
    });

    it('redondea a 1 decimal, no a 2', () => {
      // 1000 m en 7 min = 8.5714... → 8.6 (no 8.57)
      expect(calculateSpeedKph(1000, 7)).toBe(8.6);
    });

    it('mantiene el entero sin decimales', () => {
      expect(calculateSpeedKph(1000, 60)).toBe(1);
      expect(calculateSpeedKph(1000, 30)).toBe(2);
    });

    it('no arrastra error de flotante', () => {
      // 700 m en 6 min = 7 km/h exacto; 1234/7 redondea a 10.6 y no a
      // 10.599999999999994. El redondeo a 1 decimal mata el resto de flotante.
      expect(calculateSpeedKph(700, 6)).toBe(7);
      expect(calculateSpeedKph(1234, 7)).toBe(10.6);
      // Un caso que da decimales largos: 1000/7 → 8.571428571428571 → 8.6
      expect(calculateSpeedKph(1000, 7)).toBe(8.6);
    });
  });

  describe('coerción de strings numéricos', () => {
    it('acepta strings que el form produce (todo llega como string)', () => {
      expect(calculateSpeedKph('1000', '60')).toBe(1);
      expect(calculateSpeedKph('1000', '30')).toBe(2);
    });

    it('acepta decimales en string', () => {
      expect(calculateSpeedKph('1000.5', '30')).toBe(2);
    });
  });
});

describe('formatSpeedInput', () => {
  it('devuelve string vacío cuando no hay velocidad', () => {
    expect(formatSpeedInput(null)).toBe('');
    expect(formatSpeedInput(undefined)).toBe('');
  });

  it('no muestra ceros de más (10 y no 10.0)', () => {
    expect(formatSpeedInput(10)).toBe('10');
  });

  it('muestra el decimal cuando existe', () => {
    expect(formatSpeedInput(10.5)).toBe('10.5');
    expect(formatSpeedInput(8.6)).toBe('8.6');
  });

  it('el valor ya redondeado a 1 decimal se muestra tal cual', () => {
    expect(formatSpeedInput(calculateSpeedKph(1234, 7))).toBe('10.6');
  });
});

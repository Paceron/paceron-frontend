import { validateExerciseForm, hasErrors } from '../utils/exercise-validators';

// Base válida por tipo — se sobreescribe lo que cada caso cambia, para que cada
// test declare solo lo que le interesa.
function form(overrides = {}) {
  return { name: 'Fartlek', kind: 'liviano', minutes: '', distanceM: '', speedKph: '', muscleGroup: '', ...overrides };
}

const INTENTA = { attempted: true };

describe('validateExerciseForm', () => {
  describe('nombre', () => {
    it('exige nombre siempre, en cualquier tipo', () => {
      for (const kind of ['liviano', 'elongacion', 'ritmo_continuo', 'velocidad_tiempo', 'velocidad_distancia']) {
        const errors = validateExerciseForm(form({ kind, name: '  ' }), INTENTA);
        expect(errors.name).toBe('Completá el nombre.');
      }
    });

    it('no considera "   " como nombre válido', () => {
      expect(validateExerciseForm(form({ name: '   ' }), INTENTA).name).toBeTruthy();
    });

    it('no pide nombre antes de intentar guardar', () => {
      expect(validateExerciseForm(form({ name: '' })).name).toBeUndefined();
    });
  });

  describe('liviano', () => {
    it('distancia y tiempo vacíos → error de regla cruzada', () => {
      const errors = validateExerciseForm(form({ kind: 'liviano' }), INTENTA);
      expect(errors.distanceM).toBe('Completá al menos Distancia Objetivo o Tiempo Objetivo.');
      expect(hasErrors(errors)).toBe(true);
    });

    it('solo distancia → válido', () => {
      const errors = validateExerciseForm(form({ kind: 'liviano', distanceM: '3000' }), INTENTA);
      expect(errors.distanceM).toBeUndefined();
      expect(hasErrors(errors)).toBe(false);
    });

    it('solo tiempo → válido', () => {
      const errors = validateExerciseForm(form({ kind: 'liviano', minutes: '20' }), INTENTA);
      expect(errors.minutes).toBeUndefined();
      expect(hasErrors(errors)).toBe(false);
    });

    it('ambos → válido', () => {
      const errors = validateExerciseForm(form({ kind: 'liviano', distanceM: '3000', minutes: '20' }), INTENTA);
      expect(hasErrors(errors)).toBe(false);
    });

    it('no valida velocidad ni grupo muscular (ocultos en este tipo)', () => {
      const errors = validateExerciseForm(
        form({ kind: 'liviano', distanceM: '3000', speedKph: 'abc', muscleGroup: 'core' }),
        INTENTA
      );
      expect(errors.speedKph).toBeUndefined();
      expect(errors.muscleGroup).toBeUndefined();
      expect(hasErrors(errors)).toBe(false);
    });

    it('sin distancia ni tiempo no hay error antes de intentar', () => {
      expect(validateExerciseForm(form({ kind: 'liviano' })).distanceM).toBeUndefined();
    });
  });

  describe('elongacion', () => {
    it('grupo muscular vacío → error', () => {
      const errors = validateExerciseForm(form({ kind: 'elongacion', muscleGroup: '' }), INTENTA);
      expect(errors.muscleGroup).toBe('Elegí el grupo muscular.');
    });

    it('grupo muscular completo → válido', () => {
      const errors = validateExerciseForm(form({ kind: 'elongacion', muscleGroup: 'isquiotibiales' }), INTENTA);
      expect(hasErrors(errors)).toBe(false);
    });

    it('tiempo vacío → válido (es opcional)', () => {
      const errors = validateExerciseForm(form({ kind: 'elongacion', muscleGroup: 'core' }), INTENTA);
      expect(errors.minutes).toBeUndefined();
    });

    it('no valida distancia ni velocidad (ocultos en este tipo)', () => {
      const errors = validateExerciseForm(
        form({ kind: 'elongacion', muscleGroup: 'core', distanceM: '-100', speedKph: 'abc' }),
        INTENTA
      );
      expect(errors.distanceM).toBeUndefined();
      expect(errors.speedKph).toBeUndefined();
    });
  });

  describe('ritmo_continuo', () => {
    it('tiempo vacío → error', () => {
      const errors = validateExerciseForm(form({ kind: 'ritmo_continuo', distanceM: '5000' }), INTENTA);
      expect(errors.minutes).toBe('Completá el Tiempo Objetivo.');
    });

    it('distancia vacía → error', () => {
      const errors = validateExerciseForm(form({ kind: 'ritmo_continuo', minutes: '25' }), INTENTA);
      expect(errors.distanceM).toBe('Completá la Distancia Objetivo.');
    });

    it('ambos vacíos → ambos errores (no es regla cruzada)', () => {
      const errors = validateExerciseForm(form({ kind: 'ritmo_continuo' }), INTENTA);
      expect(errors.distanceM).toBe('Completá la Distancia Objetivo.');
      expect(errors.minutes).toBe('Completá el Tiempo Objetivo.');
    });

    it('ambos completos → válido sin velocidad (se calcula sola)', () => {
      const errors = validateExerciseForm(
        form({ kind: 'ritmo_continuo', distanceM: '5000', minutes: '25' }),
        INTENTA
      );
      expect(errors.speedKph).toBeUndefined();
      expect(hasErrors(errors)).toBe(false);
    });
  });

  describe('velocidad_tiempo', () => {
    it('tiempo vacío → error', () => {
      expect(validateExerciseForm(form({ kind: 'velocidad_tiempo', distanceM: '5000' }), INTENTA).minutes)
        .toBe('Completá el Tiempo Objetivo.');
    });

    it('distancia vacía → VÁLIDO (es opcional)', () => {
      const errors = validateExerciseForm(form({ kind: 'velocidad_tiempo', minutes: '25' }), INTENTA);
      expect(errors.distanceM).toBeUndefined();
      expect(hasErrors(errors)).toBe(false);
    });

    it('distancia + tiempo → válido', () => {
      const errors = validateExerciseForm(
        form({ kind: 'velocidad_tiempo', distanceM: '5000', minutes: '25' }),
        INTENTA
      );
      expect(hasErrors(errors)).toBe(false);
    });

    it('velocidad manual permitida (no es obligatoria)', () => {
      const errors = validateExerciseForm(
        form({ kind: 'velocidad_tiempo', minutes: '25', speedKph: '12' }),
        INTENTA
      );
      expect(errors.speedKph).toBeUndefined();
    });
  });

  describe('velocidad_distancia', () => {
    it('distancia vacía → error', () => {
      expect(validateExerciseForm(form({ kind: 'velocidad_distancia', minutes: '25' }), INTENTA).distanceM)
        .toBe('Completá la Distancia Objetivo.');
    });

    it('tiempo vacío → VÁLIDO (es opcional)', () => {
      const errors = validateExerciseForm(form({ kind: 'velocidad_distancia', distanceM: '5000' }), INTENTA);
      expect(errors.minutes).toBeUndefined();
      expect(hasErrors(errors)).toBe(false);
    });

    it('distancia obligatoria → tiempo cargado → válido', () => {
      const errors = validateExerciseForm(
        form({ kind: 'velocidad_distancia', distanceM: '5000', minutes: '25' }),
        INTENTA
      );
      expect(hasErrors(errors)).toBe(false);
    });
  });

  describe('validación numérica', () => {
    it('rechaza distancia negativa', () => {
      const errors = validateExerciseForm(form({ kind: 'ritmo_continuo', distanceM: '-100', minutes: '20' }));
      expect(errors.distanceM).toBe('La distancia no puede ser negativa.');
    });

    it('rechaza tiempo negativo', () => {
      const errors = validateExerciseForm(form({ kind: 'ritmo_continuo', distanceM: '100', minutes: '-5' }));
      expect(errors.minutes).toBe('El tiempo no puede ser negativo.');
    });

    it('rechaza velocidad negativa (donde el campo está visible)', () => {
      const errors = validateExerciseForm(
        form({ kind: 'ritmo_continuo', distanceM: '100', minutes: '20', speedKph: '-3' })
      );
      expect(errors.speedKph).toBe('La velocidad no puede ser negativa.');
    });

    it('rechaza texto no numérico', () => {
      expect(validateExerciseForm(form({ kind: 'ritmo_continuo', distanceM: 'abc', minutes: '20' })).distanceM)
        .toBe('La distancia tiene que ser un número.');
      expect(validateExerciseForm(form({ kind: 'ritmo_continuo', distanceM: '100', minutes: 'x' })).minutes)
        .toBe('El tiempo tiene que ser un número.');
    });

    it('acepta decimales', () => {
      const errors = validateExerciseForm(
        form({ kind: 'ritmo_continuo', distanceM: '1000.5', minutes: '20.5' }),
        INTENTA
      );
      expect(hasErrors(errors)).toBe(false);
    });

    it('tiempo 0 → error explícito (división por cero evitada)', () => {
      const errors = validateExerciseForm(form({ kind: 'ritmo_continuo', distanceM: '1000', minutes: '0' }));
      expect(errors.minutes).toBe('El tiempo tiene que ser mayor a 0.');
    });

    it('tiempo 0 da error aunque no se haya intentado guardar', () => {
      // Es matemática imposible, no una omisión — se muestra mientras escribe.
      expect(validateExerciseForm(form({ kind: 'liviano', minutes: '0' })).minutes).toBeTruthy();
    });
  });

  describe('tipo desconocido', () => {
    it('no valida nada salvo el nombre (no puede romper el form)', () => {
      const errors = validateExerciseForm(form({ kind: 'walking', distanceM: '-1', minutes: '0' }), INTENTA);
      expect(errors.name).toBeUndefined();
      expect(errors.distanceM).toBeUndefined();
      expect(errors.minutes).toBeUndefined();
      expect(hasErrors(errors)).toBe(false);
    });
  });
});

describe('hasErrors', () => {
  it('detecta mapas vacíos y con contenido', () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ name: 'x' })).toBe(true);
  });
});

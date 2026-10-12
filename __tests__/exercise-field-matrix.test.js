import {
  EXERCISE_KINDS,
  getFieldRules,
  isKnownKind,
  isSpeedAuto,
} from '../utils/exercise-field-matrix';

describe('EXERCISE_KINDS', () => {
  it('son los 5 tipos del dominio, en orden de lectura (los de velocidad primero)', () => {
    expect(EXERCISE_KINDS).toEqual([
      'velocidad_tiempo',
      'velocidad_distancia',
      'liviano',
      'elongacion',
      'ritmo_continuo',
    ]);
  });

  it('no incluye los tipos viejos (reemplazo, no alias)', () => {
    expect(EXERCISE_KINDS).not.toContain('walking');
    expect(EXERCISE_KINDS).not.toContain('jogging');
    expect(EXERCISE_KINDS).not.toContain('elongation');
    expect(EXERCISE_KINDS).not.toContain('cruising');
    expect(EXERCISE_KINDS).not.toContain('running');
  });

  it('todos son snake_case sin tilde ni ñ', () => {
    for (const kind of EXERCISE_KINDS) {
      expect(kind).toMatch(/^[a-z_]+$/);
    }
  });
});

describe('getFieldRules', () => {
  it('todos los tipos tienen reglas definidas', () => {
    for (const kind of EXERCISE_KINDS) {
      expect(getFieldRules(kind)).toBeDefined();
      expect(isKnownKind(kind)).toBe(true);
    }
  });

  describe('liviano — calentamiento o recuperación', () => {
    it('muestra distancia y tiempo, oculta velocidad y grupo muscular', () => {
      const r = getFieldRules('liviano');
      expect(r.showDistance).toBe(true);
      expect(r.showTime).toBe(true);
      expect(r.showSpeed).toBe(false);
      expect(r.showMuscleGroup).toBe(false);
    });

    it('distancia y tiempo son opcionales POR SEPARADO', () => {
      const r = getFieldRules('liviano');
      expect(r.distanceRequired).toBe(false);
      expect(r.timeRequired).toBe(false);
    });

    it('exige al menos uno de los dos (regla cruzada)', () => {
      expect(getFieldRules('liviano').requiresDistanceOrTime).toBe(true);
    });
  });

  describe('elongacion', () => {
    it('solo muestra tiempo y grupo muscular', () => {
      const r = getFieldRules('elongacion');
      expect(r.showTime).toBe(true);
      expect(r.showMuscleGroup).toBe(true);
      expect(r.showDistance).toBe(false);
      expect(r.showSpeed).toBe(false);
    });

    it('tiempo opcional, grupo muscular obligatorio', () => {
      const r = getFieldRules('elongacion');
      expect(r.timeRequired).toBe(false);
      expect(r.muscleGroupRequired).toBe(true);
    });

    it('no tiene la regla cruzada de liviano', () => {
      expect(getFieldRules('elongacion').requiresDistanceOrTime).toBe(false);
    });
  });

  describe('ritmo_continuo', () => {
    it('muestra distancia, tiempo y velocidad; oculta grupo muscular', () => {
      const r = getFieldRules('ritmo_continuo');
      expect(r.showDistance).toBe(true);
      expect(r.showTime).toBe(true);
      expect(r.showSpeed).toBe(true);
      expect(r.showMuscleGroup).toBe(false);
    });

    it('distancia Y tiempo son obligatorios (el ritmo siempre es derivable)', () => {
      const r = getFieldRules('ritmo_continuo');
      expect(r.distanceRequired).toBe(true);
      expect(r.timeRequired).toBe(true);
    });

    it('la velocidad no es obligatoria — se calcula sola', () => {
      expect(getFieldRules('ritmo_continuo').speedRequired).toBe(false);
    });
  });

  describe('velocidad_tiempo', () => {
    it('muestra los tres campos, oculta grupo muscular', () => {
      const r = getFieldRules('velocidad_tiempo');
      expect(r.showDistance).toBe(true);
      expect(r.showTime).toBe(true);
      expect(r.showSpeed).toBe(true);
      expect(r.showMuscleGroup).toBe(false);
    });

    it('tiempo obligatorio (es el que da nombre al tipo), distancia opcional', () => {
      const r = getFieldRules('velocidad_tiempo');
      expect(r.timeRequired).toBe(true);
      expect(r.distanceRequired).toBe(false);
    });
  });

  describe('velocidad_distancia', () => {
    it('muestra los tres campos, oculta grupo muscular', () => {
      const r = getFieldRules('velocidad_distancia');
      expect(r.showDistance).toBe(true);
      expect(r.showTime).toBe(true);
      expect(r.showSpeed).toBe(true);
      expect(r.showMuscleGroup).toBe(false);
    });

    it('distancia obligatoria, tiempo opcional (espejo del anterior)', () => {
      const r = getFieldRules('velocidad_distancia');
      expect(r.distanceRequired).toBe(true);
      expect(r.timeRequired).toBe(false);
    });
  });

  describe('tipo desconocido', () => {
    it('no muestra ni valida nada (no puede romper el form)', () => {
      const r = getFieldRules('walking');
      expect(r.showDistance).toBe(false);
      expect(r.showTime).toBe(false);
      expect(r.showSpeed).toBe(false);
      expect(r.showMuscleGroup).toBe(false);
      expect(r.requiresDistanceOrTime).toBe(false);
    });

    it('reporta que el tipo no es conocido', () => {
      expect(isKnownKind('walking')).toBe(false);
      expect(isKnownKind('jogging')).toBe(false);
      expect(isKnownKind('elongation')).toBe(false);
      expect(isKnownKind('cruising')).toBe(false);
      expect(isKnownKind('running')).toBe(false);
    });

    it('no cae a liviano por defecto (asumir un tipo es peor que no asumir)', () => {
      expect(getFieldRules('walking')).not.toEqual(getFieldRules('liviano'));
    });

    it('aguanta null, undefined y string vacío', () => {
      for (const bad of [null, undefined, '', 0, {}]) {
        expect(getFieldRules(bad).showSpeed).toBe(false);
      }
    });
  });
});

describe('isSpeedAuto', () => {
  it('es true solo para los 3 tipos con campo velocidad', () => {
    expect(isSpeedAuto('ritmo_continuo')).toBe(true);
    expect(isSpeedAuto('velocidad_tiempo')).toBe(true);
    expect(isSpeedAuto('velocidad_distancia')).toBe(true);
  });

  it('es false para los tipos sin campo velocidad', () => {
    expect(isSpeedAuto('liviano')).toBe(false);
    expect(isSpeedAuto('elongacion')).toBe(false);
  });

  it('depende del tipo, no de los valores', () => {
    // velocidad_tiempo calcula SOLO si hay distancia; el tipo igual "tiene"
    // velocidad. La disponibilidad real la decide el caller con los valores.
    expect(isSpeedAuto('velocidad_tiempo')).toBe(true);
  });
});

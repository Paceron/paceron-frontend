// Validación del form de ejercicios, por tipo. Funciones puras: reciben el
// form y si se intentó guardar, devuelven el mapa de errores. No tocan estado ni
// no sabe nada de componentes — el form los deriva en cada render, que es lo que// permite que un campo que queda oculto (tipo cambiado) no arrastre su error.

import { getFieldRules } from './exercise-field-matrix';

// Todo llega como string desde los inputs, y a veces vacío. "Vacío" y "no
// cargado" son la misma cosa acá: un input opcional en blanco es válido.
function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function toNumber(value) {
  if (isBlank(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

// Valida el form completo para un tipo dado.
// Devuelve `{ field: mensaje }` — vacío si todo está bien.
//
// `attempted` existe para no gritarle al usuario por un campo que todavía no
// tocó: los errores de obligatoriedad solo aparecen después de intentar
// guardar. Los errores de formato (negativo, no numérico) sí aparecen mientras
// escribe, porque son un error de tecleo, no de omisión.
export function validateExerciseForm(form, { attempted = false } = {}) {
  const rules = getFieldRules(form.kind);
  const errors = {};

  const name = String(form.name ?? '').trim();
  if (attempted && !name) {
    errors.name = 'Completá el nombre.';
  }

  // Numéricos: primero formato, después obligatoriedad.
  const distanceNum = toNumber(form.distanceM);
  const timeNum = toNumber(form.minutes);
  const speedNum = toNumber(form.speedKph);

  if (rules.showDistance) {
    if (Number.isNaN(distanceNum)) {
      errors.distanceM = 'La distancia tiene que ser un número.';
    } else if (distanceNum !== null && distanceNum < 0) {
      errors.distanceM = 'La distancia no puede ser negativa.';
    } else if (rules.distanceRequired && attempted && isBlank(form.distanceM)) {
      errors.distanceM = 'Completá la Distancia Objetivo.';
    }
  }

  if (rules.showTime) {
    if (Number.isNaN(timeNum)) {
      errors.minutes = 'El tiempo tiene que ser un número.';
    } else if (timeNum !== null && timeNum < 0) {
      errors.minutes = 'El tiempo no puede ser negativo.';
    } else if (timeNum === 0) {
      // Cero es "formato válido, matemática imposible": sin esto la velocidad
      // sería división por cero. Se valida siempre, no solo al guardar.
      errors.minutes = 'El tiempo tiene que ser mayor a 0.';
    } else if (rules.timeRequired && attempted && isBlank(form.minutes)) {
      errors.minutes = 'Completá el Tiempo Objetivo.';
    }
  }

  if (rules.showSpeed) {
    if (Number.isNaN(speedNum)) {
      errors.speedKph = 'La velocidad tiene que ser un número.';
    } else if (speedNum !== null && speedNum < 0) {
      errors.speedKph = 'La velocidad no puede ser negativa.';
    }
  }

  if (rules.showMuscleGroup && rules.muscleGroupRequired && attempted && isBlank(form.muscleGroup)) {
    errors.muscleGroup = 'Elegí el grupo muscular.';
  }

  // La única regla cruzada del dominio. Va sobre distancia, que es el primer
  // campo visible del form — el error se ve sin scroll.
  if (rules.requiresDistanceOrTime && attempted && isBlank(form.distanceM) && isBlank(form.minutes)) {
    errors.distanceM = 'Completá al menos Distancia Objetivo o Tiempo Objetivo.';
  }

  return errors;
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

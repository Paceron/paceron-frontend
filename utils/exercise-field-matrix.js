// Qué campos se ven y cuáles son obligatorios en el form de ejercicios, según
// el tipo. Es la única fuente de verdad de esa matriz: el componente la lee y
// los tests la recorren entera, así que la regla no puede quedar implícita en el
// JSX (que además nadie testea — el proyecto no hace render de componentes).
//
// Reemplaza el modelo anterior, donde NADA dependía del `kind`: todos los campos
// eran opcionales para cualquier tipo (docs/BACKEND_TRAINING_PLANS_SPEC.md §3.1,
// y el commit 3831fcf que lo revirtió). Ahora el tipo declara qué datos lo
// definen — ver docs/superpowers/specs/ para el porqué.

// Los 5 tipos, en orden de lectura — el form itera esto para el selector, así
// que el orden ES el que se ve. Los dos de velocidad van primero (pedido del
// usuario): son los de label más largo, y al abrir la fila es donde más se
// nota el espacio que deja el pill activo expandido.
export const EXERCISE_KINDS = ['velocidad_tiempo', 'velocidad_distancia', 'liviano', 'elongacion', 'ritmo_continuo'];

// Reglas por tipo. Los `show*` controlan visibilidad; los `required*` controlan
// obligatoriedad (solo tiene sentido mirar un required* si el show* es true).
//
// `requiresDistanceOrTime` es la única regla cruzada del dominio: en `liviano`
// distancia y tiempo son opcionales POR SEPARADO pero guardar exige al menos
// uno de los dos.
const RULES = {
  // Calentamiento o recuperación. Se characterize por volumen, no por ritmo:
  // podés decir "5 km" o "20 minutos" y está completo. La velocidad no aplica
  // (no es un ejercicio cronometrado con ritmo objetivo), y el grupo muscular
  // tampoco (no es un movimiento de fuerza concreto).
  liviano: {
    showDistance: true,
    showTime: true,
    showSpeed: false,
    showMuscleGroup: false,
    distanceRequired: false,
    timeRequired: false,
    speedRequired: false,
    muscleGroupRequired: false,
    requiresDistanceOrTime: true,
  },
  // Estiramiento. No hay distancia ni velocidad (no se desplaza), el tiempo es
  // opcional (un hold de 30s no necesita los dos). Lo que lo define es qué se
  // estira, así que grupo muscular es obligatorio.
  elongacion: {
    showDistance: false,
    showTime: true,
    showSpeed: false,
    showMuscleGroup: true,
    distanceRequired: false,
    timeRequired: false,
    speedRequired: false,
    muscleGroupRequired: true,
    requiresDistanceOrTime: false,
  },
  // Ritmo continuo: se define por distancia Y tiempo — de ahí sale la velocidad.
  // Ambos obligatorios justamente para que el ritmo siempre sea derivable.
  ritmo_continuo: {
    showDistance: true,
    showTime: true,
    showSpeed: true,
    showMuscleGroup: false,
    distanceRequired: true,
    timeRequired: true,
    speedRequired: false,
    muscleGroupRequired: false,
    requiresDistanceOrTime: false,
  },
  // Velocidad en tiempo: el tiempo es el dato que da nombre al tipo, entonces es
  // obligatorio. La distancia es el dato opcional — si la cargás, la velocidad
  // sale sola; si no, la cargás a mano.
  velocidad_tiempo: {
    showDistance: true,
    showTime: true,
    showSpeed: true,
    showMuscleGroup: false,
    distanceRequired: false,
    timeRequired: true,
    speedRequired: false,
    muscleGroupRequired: false,
    requiresDistanceOrTime: false,
  },
  // Velocidad en distancia: espejo del anterior. La distancia es la que da
  // nombre al tipo y es obligatoria; el tiempo es el opcional.
  velocidad_distancia: {
    showDistance: true,
    showTime: true,
    showSpeed: true,
    showMuscleGroup: false,
    distanceRequired: true,
    timeRequired: false,
    speedRequired: false,
    muscleGroupRequired: false,
    requiresDistanceOrTime: false,
  },
};

// Rules de un tipo desconocido: no mostrás nada ni validás nada. Preferible a
// tirar: un `kind` que noicefamos (dato viejo, backend desalineado) no puede
// romper el form. El default NO es `liviano` a propósito — asumir un tipo es
// peor que no asumir.
const UNKNOWN_KIND_RULES = {
  showDistance: false,
  showTime: false,
  showSpeed: false,
  showMuscleGroup: false,
  distanceRequired: false,
  timeRequired: false,
  speedRequired: false,
  muscleGroupRequired: false,
  requiresDistanceOrTime: false,
};

export function getFieldRules(kind) {
  return RULES[kind] || UNKNOWN_KIND_RULES;
}

export function isKnownKind(kind) {
  return Object.prototype.hasOwnProperty.call(RULES, kind);
}

// ¿El tipo tiene campo velocidad? Distingue "el tipo tiene velocidad" (showSpeed,
// propiedad del tipo) de "este ejercicio particular ya se puede calcular" — que
// depende de los valores, no del tipo.
export function isSpeedAuto(kind) {
  return getFieldRules(kind).showSpeed;
}

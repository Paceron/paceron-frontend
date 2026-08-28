// "Personalidad" visual del módulo de planes — cada tipo de ejercicio
// tiene su propio ícono y color (antes todo era gris neutro). El color no
// es decorativo nomás: comunica intensidad/tipo de esfuerzo de un
// vistazo, mismo criterio de "semáforo con intención" que ya usa el
// resto de la app (SUBSCRIPTION_META, TEAM_STATUS_META) pero acá el
// significado es el tipo de ejercicio, no un estado de urgencia.
export const EXERCISE_KIND_META = {
  walking: { label: 'Caminata', icon: 'walk', iconColor: '#0284c7', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
  jogging: { label: 'Trote suave', icon: 'run', iconColor: '#d97706', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  elongation: { label: 'Elongación', icon: 'yoga', iconColor: '#9333ea', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  cruising: { label: 'Ritmo continuo', icon: 'speedometer', iconColor: '#0d9488', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400' },
  running: { label: 'Corrida', icon: 'run-fast', iconColor: '#ea580c', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
};

export const DAY_KIND_META = {
  rest: { label: 'Descanso', icon: 'sleep', iconColor: '#64748b', bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300' },
  marathon: { label: 'Maratón', icon: 'trophy-outline', iconColor: '#d97706', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  other: { label: 'Otra actividad', icon: 'star-four-points-outline', iconColor: '#0284c7', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
  training: { label: 'Entrenamiento', icon: 'run-fast', iconColor: '#8cc63e', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
};

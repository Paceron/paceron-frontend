// Documentación de cada métrica del producto.
//
// Vive en `utils/` y no en el componente porque es contenido PURO: cada entrada
// es un objeto de datos que la ventana de ayuda (`MetricHelpSheet`) solo
// renderiza. Así el texto se puede testear sin montar un modal y el catálogo
// completo se revisa en un solo archivo.
//
// Reglas de redacción (pedido 2026-11-12):
//   - Lenguaje llano, nivel secundario. Nada de Σ ni de fórmulas sin explicar:
//     las cuentas se muestran con los números puestos.
//   - Siempre un ejemplo numérico cuando la métrica tenga cálculo: una tabla o
//     una cuenta paso a paso.
//   - Se explica también el error típico (sumar velocidades, comparar tiempos
//     de distancias distintas, leer un «—» como cero).
//
// La unidad y el valor NO se recalculan acá: el texto describe la fórmula que
// ya aplica el backend (`domains/dashboard/*.go`), igual que los tooltips.
//
// Estructura de cada entrada:
//   id        nombre del campo del backend (o un alias resuelto en ALIASES)
//   title     título corto de la ventana
//   summary   una o dos frases: qué es el número
//   sections  bloques tipados que renderiza MetricHelpSheet
//
// Tipos de bloque:
//   { kind: 'heading', text }
//   { kind: 'paragraph', text }
//   { kind: 'formula', text }
//   { kind: 'table', columns, rows, note? }
//   { kind: 'list', items: [{ label?, text }] }
//   { kind: 'steps', items: [{ text }] }
//   { kind: 'note', title?, text }

export const METRIC_HELP = {
  achieved_speed_kph: {
    id: 'achieved_speed_kph',
    title: 'Ritmo promedio / velocidad promedio',
    summary: 'Un solo número que resume la velocidad de todas las series del período. Se muestra en km/h; el ritmo en minutos por kilómetro es la misma información expresada al revés.',
    sections: [
      {
        kind: 'paragraph',
        text: 'La velocidad dice cuántos kilómetros recorrés en una hora. El ritmo dice cuánto tardás en recorrer un kilómetro. Son dos formas de decir lo mismo: 12 km/h es lo mismo que 5 minutos por kilómetro.',
      },
      {
        kind: 'table',
        columns: ['Velocidad', 'Ritmo'],
        rows: [
          ['8 km/h', '7:30 min/km'],
          ['10 km/h', '6:00 min/km'],
          ['12 km/h', '5:00 min/km'],
          ['15 km/h', '4:00 min/km'],
        ],
        note: 'Para pasar de km/h a min/km se divide 60 por la velocidad: 60 ÷ 12 = 5. Por eso, cuando la velocidad sube, el ritmo baja.',
      },
      { kind: 'heading', text: 'Cómo se calcula' },
      {
        kind: 'paragraph',
        text: 'Primero se calcula la velocidad de cada serie: distancia ÷ tiempo. Después se combinan todas en un solo número, pero no todas pesan igual: cada serie pesa según su distancia. A esto se lo llama media ponderada por distancia.',
      },
      {
        kind: 'formula',
        text: 'Ritmo promedio = suma de (distancia de cada serie × su velocidad) ÷ suma de las distancias',
      },
      {
        kind: 'steps',
        items: [
          { text: 'Se multiplica la distancia de cada serie por su propia velocidad.' },
          { text: 'Se suman todos esos resultados.' },
          { text: 'Se divide por la distancia total recorrida.' },
        ],
      },
      { kind: 'heading', text: 'Ejemplo' },
      {
        kind: 'table',
        columns: ['Serie', 'Distancia', 'Tiempo', 'Velocidad', 'Distancia × velocidad'],
        rows: [
          ['A', '1 km', '4:00', '15 km/h', '15'],
          ['B', '20 km', '2:00:00', '10 km/h', '200'],
          ['Total', '21 km', '2:04:00', '—', '215'],
        ],
        note: '215 ÷ 21 = 10,2 km/h. Comprobación: 21 km en 2 h 4 min dan 10,2 km/h. La serie larga manda; la de 1 km casi no mueve el resultado.',
      },
      { kind: 'heading', text: 'Por qué no se suman las velocidades' },
      {
        kind: 'list',
        items: [
          {
            label: 'Sumar',
            text: '15 + 10 = 25 km/h. Sumar velocidades no da una velocidad: si hacés diez series, el número crece aunque corras siempre igual.',
          },
          {
            label: 'Promedio simple',
            text: '(15 + 10) ÷ 2 = 12,5 km/h. Le da el mismo peso a 1 km que a 20 km, y da un ritmo (4:48) que no es el del período.',
          },
          {
            label: 'Ponderado por distancia',
            text: '215 ÷ 21 = 10,2 km/h, que equivale a 5:52 min/km: prácticamente el ritmo real del período (5:54).',
          },
        ],
      },
      {
        kind: 'note',
        title: 'Solo series válidas',
        text: 'Entran las series que tienen distancia y tiempo medibles. Una serie de fuerza o sin distancia no cuenta. Si no hay ninguna serie válida, el número se muestra como «—».',
      },
      {
        kind: 'note',
        title: 'En el resumen del Home',
        text: 'La pestaña «Números generales» calcula este mismo promedio solo con las series de ritmo continuo. Las demás pestañas lo calculan con las series de su tipo.',
      },
    ],
  },

  target_speed_kph: {
    id: 'target_speed_kph',
    title: 'Velocidad esperada',
    summary: 'La velocidad que pide el plan para este ejercicio. No sale de tus resultados: es el objetivo contra el que se compara lo que corriste.',
    sections: [
      {
        kind: 'paragraph',
        text: 'El entrenador carga un objetivo de ritmo cuando asigna el ejercicio. La app guarda ese valor en ese momento y lo muestra como referencia fija.',
      },
      {
        kind: 'formula',
        text: 'Velocidad esperada = la del plan. No se calcula con tus series.',
      },
      {
        kind: 'table',
        columns: ['Objetivo', 'Equivale a'],
        rows: [
          ['11 km/h', '5:27 min/km'],
          ['12 km/h', '5:00 min/km'],
          ['14 km/h', '4:17 min/km'],
        ],
        note: 'La conversión es la misma de siempre: 60 ÷ velocidad = minutos por kilómetro.',
      },
      {
        kind: 'note',
        title: 'Es una foto del objetivo',
        text: 'Si el plan se edita después, este número no cambia: refleja el objetivo vigente al momento de asignar el ejercicio. Por eso puede no coincidir con lo que hoy muestra la ficha del plan.',
      },
      {
        kind: 'paragraph',
        text: 'Cuando el ejercicio no tiene una velocidad objetivo cargada (por ejemplo, uno medido solo por distancia), la tarjeta muestra «—».',
      },
    ],
  },

  delta: {
    id: 'delta',
    title: 'Delta contra objetivo',
    summary: 'Cuánto más rápido o más lento fuiste respecto del objetivo, en porcentaje. Positivo es mejor que el objetivo; negativo, peor.',
    sections: [
      {
        kind: 'paragraph',
        text: 'Compara lo logrado con lo esperado. Un +10 % significa que fuiste un 10 % más rápido; un −10 %, un 10 % más lento. El 0 % es haber dado justo en el objetivo.',
      },
      {
        kind: 'formula',
        text: 'Delta % = (ritmo logrado − ritmo esperado) ÷ ritmo esperado × 100',
      },
      {
        kind: 'table',
        columns: ['Esperado', 'Logrado', 'Cuenta', 'Delta'],
        rows: [
          ['12 km/h', '13,2 km/h', '(13,2 − 12) ÷ 12 × 100', '+10 %'],
          ['12 km/h', '10,8 km/h', '(10,8 − 12) ÷ 12 × 100', '−10 %'],
          ['12 km/h', '12 km/h', '(12 − 12) ÷ 12 × 100', '0 %'],
        ],
        note: 'Un +10 % no son "10 segundos más rápido": es 10 % de la velocidad. Sobre 12 km/h son 1,2 km/h más.',
      },
      { kind: 'heading', text: 'Según cómo se mida el ejercicio' },
      {
        kind: 'list',
        items: [
          { label: 'Con objetivo de ritmo', text: 'se comparan las velocidades, como en el ejemplo.' },
          { label: 'Medido por tiempo', text: 'se compara el tiempo total logrado contra el tiempo total pedido, sobre las series que tienen objetivo. Como en el tiempo menos es mejor, el signo se invierte: terminar antes da positivo.' },
          { label: 'Medido por distancia', text: 'se compara la distancia lograda contra la distancia pedida, sobre las series con objetivo.' },
        ],
      },
      {
        kind: 'note',
        title: 'Sin comparación posible',
        text: 'Si el ejercicio no tiene objetivo, o no hay series válidas, la tarjeta muestra «—». Un 0 % sería "diste justo en el objetivo", que es otra cosa.',
      },
    ],
  },

  compliance_rate: {
    id: 'compliance_rate',
    title: 'Cumplimiento',
    summary: 'Qué porcentaje de las series con objetivo lo cumplieron, dentro de la tolerancia permitida.',
    sections: [
      {
        kind: 'paragraph',
        text: 'Cada serie que tiene objetivo se compara con ese objetivo. Si queda dentro del margen de tolerancia, cuenta como cumplida. El resultado es cuántas cumplieron sobre el total de series que tenían objetivo.',
      },
      {
        kind: 'formula',
        text: 'Cumplimiento % = series que cumplieron ÷ series con objetivo × 100',
      },
      {
        kind: 'paragraph',
        text: 'La tolerancia por defecto es del 5 %. Sirve para que un objetivo no sea una línea exacta: sin margen, fallar por una décima haría que la serie no cuente.',
      },
      { kind: 'heading', text: 'Ejemplo con objetivo de tiempo' },
      {
        kind: 'table',
        columns: ['Serie', 'Objetivo', 'Logrado', '¿Cumple?'],
        rows: [
          ['A', '30:00', '29:10', 'Sí'],
          ['B', '30:00', '30:00', 'Sí'],
          ['C', '30:00', '31:00', 'Sí'],
          ['D', '30:00', '32:00', 'No'],
        ],
        note: 'Con 5 % de tolerancia, el objetivo de 30:00 admite hasta 31:30. La serie C entra; la D queda afuera. Cumplieron 3 de 4: 75 %.',
      },
      { kind: 'heading', text: 'Qué se exige según el tipo de ejercicio' },
      {
        kind: 'list',
        items: [
          { label: 'Velocidad en tiempo o elongación', text: 'se exige el tiempo.' },
          { label: 'Velocidad en distancia', text: 'se exige la distancia.' },
          { label: 'Ritmo continuo', text: 'se exigen las dos cosas: cumplir el tiempo pero quedarse corto de distancia no cuenta como cumplido.' },
          { label: 'Liviano', text: 'alcanza con cumplir uno de los dos objetivos cargados.' },
        ],
      },
      {
        kind: 'note',
        title: 'Pasarse también cumple',
        text: 'Correr más rápido que el objetivo o cubrir más distancia que la pedida cuenta como cumplimiento. La tolerancia solo perdona quedarse un poco corto, nunca es un techo.',
      },
      {
        kind: 'note',
        title: 'El denominador importa',
        text: 'Solo se cuentan las series que tienen objetivo cargado. Si ninguna lo tiene, la tarjeta muestra «—»: no es 0 % de cumplimiento.',
      },
    ],
  },

  cv: {
    id: 'cv',
    title: 'Consistencia',
    summary: 'Cuán parejas fueron tus velocidades entre series. Cuanto más bajo el número, más regular fuiste.',
    sections: [
      {
        kind: 'paragraph',
        text: 'Si todas tus series salieron a la misma velocidad, la consistencia es 0 %. Cuanto más se mezclan series rápidas y lentas, más alto el número. Se expresa en porcentaje para poder comparar períodos que corriste a velocidades distintas.',
      },
      {
        kind: 'formula',
        text: 'Consistencia = desvío ÷ promedio de las velocidades × 100',
      },
      {
        kind: 'paragraph',
        text: 'El desvío mide, en promedio, cuánto se aleja cada serie de la velocidad promedio. Se calcula así: se resta el promedio a cada velocidad, se elevan esas diferencias al cuadrado, se promedian y se saca raíz. Elevar al cuadrado evita que las diferencias para arriba y para abajo se cancelen.',
      },
      { kind: 'heading', text: 'Ejemplos' },
      {
        kind: 'table',
        columns: ['Velocidades', 'Promedio', 'Consistencia'],
        rows: [
          ['10 · 10 · 10 km/h', '10 km/h', '0 %'],
          ['9 · 10 · 11 km/h', '10 km/h', '8 %'],
          ['8 · 10 · 12 km/h', '10 km/h', '16 %'],
          ['6 · 10 · 14 km/h', '10 km/h', '33 %'],
        ],
        note: 'El promedio es 10 en los cuatro casos. Lo que cambia es la dispersión: por eso una consistencia baja no significa "lento", significa "parejo".',
      },
      {
        kind: 'note',
        title: 'Menos de dos series',
        text: 'Con una sola serie no hay nada que comparar, así que se muestra «—».',
      },
      {
        kind: 'note',
        title: 'Se calcula sobre velocidad, no sobre ritmo',
        text: 'Se usa km/h porque el ritmo es su inverso: promediar ritmos cambiaría el resultado y hasta el sentido de "mejor". Con velocidad, más alto siempre es mejor.',
      },
    ],
  },

  best_time_ms: {
    id: 'best_time_ms',
    title: 'Mejor tiempo',
    summary: 'El tiempo más corto entre las series válidas del período. Cuando el ejercicio no tiene objetivo cargado, es la marca que se lee sola.',
    sections: [
      {
        kind: 'paragraph',
        text: 'La mejor marca es la serie que completaste en menos tiempo. No se compara contra un objetivo: solo se busca el menor tiempo del período.',
      },
      {
        kind: 'formula',
        text: 'Mejor tiempo = el menor tiempo entre las series válidas del período.',
      },
      {
        kind: 'table',
        columns: ['Serie', 'Tiempo'],
        rows: [
          ['1', '4:52'],
          ['2', '4:38'],
          ['3', '5:10'],
          ['4', '4:45'],
        ],
        note: 'El mejor tiempo es 4:38: es el menor de los cuatro.',
      },
      {
        kind: 'note',
        title: 'Ojo con las distancias',
        text: 'Comparar tiempos de distancias distintas no es válido: 400 m en 1:10 no es "mejor" que 5 km en 20:00. La marca se lee siempre dentro del mismo ejercicio.',
      },
      {
        kind: 'note',
        title: 'Un cero no es una marca',
        text: 'Nadie corre una serie en 0 segundos. Si el dato no existe, la tarjeta muestra «—» y nunca 00:00.',
      },
    ],
  },

  best_time_met_ms: {
    id: 'best_time_met_ms',
    title: 'Mejor tiempo cumplido',
    summary: 'El tiempo más corto entre las series que cumplieron el objetivo.',
    sections: [
      {
        kind: 'paragraph',
        text: 'En un ejercicio con objetivo, el tiempo más corto de cualquier serie puede ser engañoso: la serie más rápida puede haberse quedado corta de distancia o haber quedado fuera del objetivo. Por eso esta tarjeta solo mira las series que sí cumplieron.',
      },
      {
        kind: 'formula',
        text: 'Mejor tiempo cumplido = el menor tiempo entre las series que cumplieron el objetivo, dentro de la tolerancia.',
      },
      {
        kind: 'table',
        columns: ['Serie', 'Tiempo', '¿Cumplió?'],
        rows: [
          ['1', '4:52', 'Sí'],
          ['2', '4:38', 'Sí'],
          ['3', '4:20', 'No'],
          ['4', '5:05', 'Sí'],
        ],
        note: 'La serie 3 fue la más rápida, pero no cumplió (en ritmo continuo se piden tiempo y distancia juntos). Las que cumplieron son 1, 2 y 4: la mejor es 4:38.',
      },
      {
        kind: 'note',
        title: 'Si no cumplió ninguna',
        text: 'No hay marca que mostrar y aparece «—». Es distinto de "no hay datos": hubo series, pero ninguna dentro del objetivo.',
      },
      {
        kind: 'note',
        title: 'Con qué se evalúa',
        text: 'El objetivo se evalúa con la tolerancia que muestra el tooltip de la tarjeta. Pasarse del objetivo (correr más rápido) también cuenta como cumplir.',
      },
    ],
  },

  distance_m: {
    id: 'distance_m',
    title: 'Distancia (volumen)',
    summary: 'La suma de la distancia de las series válidas del período. Es el volumen de trabajo, no una marca.',
    sections: [
      {
        kind: 'paragraph',
        text: 'Cada serie aporta su distancia y el total es la suma de todas. Una serie sin distancia registrada no suma.',
      },
      {
        kind: 'formula',
        text: 'Distancia total = suma de la distancia de cada serie válida',
      },
      {
        kind: 'table',
        columns: ['Serie', 'Distancia', 'Acumulado'],
        rows: [
          ['1', '2,0 km', '2,0 km'],
          ['2', '5,0 km', '7,0 km'],
          ['3', '10,0 km', '17,0 km'],
        ],
        note: 'El volumen del período es 17 km.',
      },
      {
        kind: 'note',
        title: 'Series válidas',
        text: 'Solo entran las series con datos medibles. Una serie de fuerza o sin distancia no suma metros, y si no hay ninguna serie válida se muestra «—», no 0.',
      },
    ],
  },

  sessions: {
    id: 'sessions',
    title: 'Entrenamientos',
    summary: 'Cuántas sesiones distintas aportaron datos al período.',
    sections: [
      {
        kind: 'paragraph',
        text: 'Una sesión es un entrenamiento. Se cuentan sesiones distintas, no series: un entrenamiento con seis series suma 1.',
      },
      {
        kind: 'formula',
        text: 'Entrenamientos = cantidad de sesiones distintas con al menos una serie en el período.',
      },
      {
        kind: 'table',
        columns: ['Día', 'Series', 'Suma'],
        rows: [
          ['Lunes', '6', '1 entrenamiento'],
          ['Miércoles', '4', '1 entrenamiento'],
          ['Total', '10', '2 entrenamientos'],
        ],
        note: 'Los dos días tuvieron varias series, pero cada uno suma un solo entrenamiento.',
      },
      {
        kind: 'note',
        title: 'Series no medibles',
        text: 'Una sesión con series que no se pueden medir igual cuenta: el entrenamiento existió.',
      },
    ],
  },

  series: {
    id: 'series',
    title: 'Series',
    summary: 'Cuántas series se registraron en el período, incluidas las que no se pueden medir.',
    sections: [
      {
        kind: 'paragraph',
        text: 'Una serie es cada bloque de repeticiones dentro de un entrenamiento. Por ejemplo, una sesión de 5 × 1000 m tiene 5 series.',
      },
      {
        kind: 'formula',
        text: 'Series = cantidad de series registradas en el período.',
      },
      {
        kind: 'table',
        columns: ['Entrenamiento', 'Series'],
        rows: [
          ['Lunes', '6'],
          ['Miércoles', '4'],
        ],
        note: 'Total: 10 series en 2 entrenamientos.',
      },
      {
        kind: 'note',
        title: 'No es lo mismo que "Series usadas"',
        text: 'El tooltip muestra "Series usadas": esa cuenta solo incluye las series con datos suficientes para calcular el número. Acá se cuentan todas, midan o no.',
      },
    ],
  },

  time_ms: {
    id: 'time_ms',
    title: 'Tiempo total',
    summary: 'La suma del tiempo de las series válidas del período.',
    sections: [
      {
        kind: 'paragraph',
        text: 'Cada serie aporta el tiempo que tardaste en completarla y el total es la suma.',
      },
      {
        kind: 'formula',
        text: 'Tiempo total = suma del tiempo logrado en cada serie válida',
      },
      {
        kind: 'table',
        columns: ['Serie', 'Tiempo', 'Acumulado'],
        rows: [
          ['1', '4:00', '4:00'],
          ['2', '12:30', '16:30'],
          ['3', '25:00', '41:30'],
        ],
        note: 'El tiempo total es 41:30. Cuando pasa de una hora se muestra como h:mm:ss.',
      },
      {
        kind: 'note',
        title: 'No es el tiempo de la sesión',
        text: 'No incluye descansos ni pausas entre series: suma el tiempo de las series, no el reloj desde que empezaste a entrenar.',
      },
    ],
  },

  best_speed_kph: {
    id: 'best_speed_kph',
    title: 'Mejor velocidad',
    summary: 'La velocidad promedio más alta lograda en una sola serie.',
    sections: [
      {
        kind: 'paragraph',
        text: 'No es un promedio del período: es tu mejor serie. Por eso puede ser bastante más alta que la velocidad promedio.',
      },
      {
        kind: 'formula',
        text: 'Mejor velocidad = el mayor valor entre las velocidades promedio de las series válidas.',
      },
      {
        kind: 'table',
        columns: ['Serie', 'Velocidad'],
        rows: [
          ['1', '11,8 km/h'],
          ['2', '14,2 km/h'],
          ['3', '12,0 km/h'],
        ],
        note: 'La mejor velocidad es 14,2 km/h.',
      },
      {
        kind: 'note',
        title: 'Una serie corta puede ganar',
        text: 'Como es el máximo de una sola serie, una serie muy corta puede quedar arriba. Para saber cuánto corriste en total, mirá la distancia.',
      },
    ],
  },

  best_day_distance_m: {
    id: 'best_day_distance_m',
    title: 'Mayor distancia en un día',
    summary: 'El día en que acumulaste más distancia, sumando todas las sesiones de ese día.',
    sections: [
      {
        kind: 'paragraph',
        text: 'No es la serie más larga: es el día con más metros acumulados, aunque hayan sido varias sesiones.',
      },
      {
        kind: 'formula',
        text: 'Se suma la distancia de cada día y se toma el día con el total más alto.',
      },
      {
        kind: 'table',
        columns: ['Día', 'Sesiones', 'Total'],
        rows: [
          ['Lunes', '1', '7,0 km'],
          ['Miércoles', '2', '9,5 km'],
          ['Viernes', '1', '5,0 km'],
        ],
        note: 'El miércoles suma 3,0 km + 6,5 km = 9,5 km, así que es el mayor día. Si hay empate, se muestra el día más antiguo.',
      },
      {
        kind: 'note',
        title: 'Solo series válidas',
        text: 'Las series sin distancia medible no suman al total del día.',
      },
    ],
  },

  best_distance_m: {
    id: 'best_distance_m',
    title: 'Mayor distancia en un ejercicio',
    summary: 'La distancia más larga lograda en una sola serie.',
    sections: [
      {
        kind: 'paragraph',
        text: 'Mide una serie, no el total del día: la serie más larga que completaste en el período.',
      },
      {
        kind: 'formula',
        text: 'Mayor distancia = el mayor valor entre las distancias de las series.',
      },
      {
        kind: 'table',
        columns: ['Serie', 'Distancia'],
        rows: [
          ['1', '1,0 km'],
          ['2', '3,0 km'],
          ['3', '2,0 km'],
        ],
        note: 'La mayor distancia en un solo ejercicio es 3,0 km.',
      },
    ],
  },

  no_target: {
    id: 'no_target',
    title: 'Distancia al objetivo',
    summary: 'Cuánto te faltó o te sobró para alcanzar la distancia objetivo. Sin objetivo cargado no hay número que mostrar.',
    sections: [
      {
        kind: 'paragraph',
        text: 'Esta tarjeta necesita que el ejercicio tenga un objetivo de distancia. Si el plan no lo cargó, no hay contra qué comparar y se muestra «—».',
      },
      {
        kind: 'note',
        title: 'Un «—» no es un cero',
        text: 'No significa que no entrenaste ni que te faltó todo: significa que el ejercicio no tiene objetivo cargado. Un cero se leería como "no llegué", que es otra cosa.',
      },
      {
        kind: 'paragraph',
        text: 'Cuando el ejercicio sí tiene objetivo, la pantalla muestra la otra paleta: la distancia pedida, el delta y el cumplimiento. Esta tarjeta vacía es justamente la señal de que falta ese objetivo en el plan.',
      },
    ],
  },
};

// La misma documentación sirve para campos con otro nombre. `average_speed_kph`
// es el nombre del resumen del Home para la velocidad promedio: es el mismo
// concepto y el mismo cálculo, así que no se duplica el texto.
const ALIASES = {
  average_speed_kph: 'achieved_speed_kph',
  total_distance_m: 'distance_m',
};

// Devuelve la entrada de documentación de una métrica, o null si no existe.
// null es el contrato que usa `MetricHelpSheet` para no abrir una ventana vacía
// y el que usan las tarjetas para no mostrar un link que no lleva a ningún lado.
export function metricHelp(id) {
  if (!id) return null;
  const key = ALIASES[id] ?? id;
  return METRIC_HELP[key] ?? null;
}

// Ids que tienen documentación propia. Los tests lo usan para verificar que
// todas las tarjetas que muestran "Más información" apunten a algo real.
export function documentedMetricIds() {
  return Object.keys(METRIC_HELP);
}

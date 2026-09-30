// Los ids de la app llegan mezclados de tipo, y no por descuido: el backend los
// devuelve numéricos (JSON) mientras que lo que viene de un query param o de un
// deep link llega como string. `use-team-roster.js` además normaliza `userId` a
// string a propósito, porque se compara como string en el resto del código.
//
// El síntoma de comparar con `===` es siempre el peor posible: no hay error
// visible, solo un valor que "no aparece elegido" en la UI. El caso real de
// este change es el deep link de la pantalla de asistencia
// (`/attendance?team_id=5&session_instance_id=42`): la opción viene del backend
// como Number y el id del deep link como string, así que con `===` el selector
// mostraría el placeholder teniendo la sesión elegida.
//
// Se normaliza a string en los dos lados en vez de castear a Number porque el
// caller no siempre puede: un id que todavía no se sabe si es numérico (un slug,
// un identificador externo) tiene que seguir comparándose bien.

export function isSameId(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a) === String(b);
}

// Deduplica una lista de opciones por identidad normalizada, dejando la primera
// ocurrencia.
//
// Existe por un caso concreto: si `options` mezclara `42` y `'42'`, sin esto las
// DOS filas quedarían marcadas como seleccionadas a la vez (el `isSameId` las
// considera la misma opción) y los ids de una pisarían a la otra, porque
// `nativeID` se construye a partir del id. Se descarta la segunda en vez de
// avisar: para el caller son la misma sesión, y no elegir dos veces en un
// selector es el comportamiento correcto.
export function dedupeById(options) {
  const seen = new Set();
  const out = [];
  for (const option of options ?? []) {
    if (option?.id === null || option?.id === undefined) continue;
    const key = String(option.id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(option);
  }
  return out;
}

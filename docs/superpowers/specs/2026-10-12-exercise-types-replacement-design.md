# Reemplazo del enum de tipos de ejercicio + refactor del form

**Fecha:** 2026-10-12
**Rama:** `feature/exercise-types-replacement`
**Alcance:** frontend (`paceron-frontend`). Requiere 3 cambios coordizados en `paceron-backend` (Go) — ver §7.

---

## 1. Qué cambia

El enum `kind` de los ejercicios pasa de 5 valores a 5 valores distintos, y el form
empieza a usar la matriz de campos que el prompt de negocio define:

| antes | después |
|---|---|
| `walking` — Caminata | `liviano` — Liviano (calentamiento o recuperación) |
| `jogging` — Trote | `ritmo_continuo` — Ritmo continuo |
| `elongation` — Elongación | `elongacion` — Elongación |
| `cruising` — Ritmo continuo | `velocidad_tiempo` — Velocidad en tiempo |
| `running` — Corrida | `velocidad_distancia` — Velocidad en distancia |

Y el campo `intensity` (`light`/`moderate`/`vigorous`) **se elimina del producto**.

Esto **invierte** la decisión de negocio vigente hasta ahora, escrita en
`docs/BACKEND_TRAINING_PLANS_SPEC.md:51` ("nada depende del `kind`") y que el
frontend ya había implementado y revertido una vez (commit `3831fcf`). La razón del
revertido era que mapear campos por tipo "terminaba siendo más complejidad de la que
valía dado lo variado que es un ejercicio real". Este branch la da por buena igual,
con la diferencia de que ahora la regla no vive esparcida en el JSX sino en una función
pura testeada.

## 2. La matriz

Fuente única: `utils/exercise-field-matrix.js`. El componente la lee; los tests la
recorren entera. El proyecto no hace render de componentes (convención de `CLAUDE.md`),
así que si la matriz viviera en el JSX no estaría probada.

| kind | Distancia | Tiempo | Velocidad | Grupo muscular |
|---|---|---|---|---|
| `liviano` | visible, necesaria¹ | visible, necesaria¹ | oculta | oculto |
| `elongacion` | oculto | visible, opcional | oculta | visible, **obligatorio** |
| `ritmo_continuo` | visible, **obligatorio** | visible, **obligatorio** | visible, opcional | oculto |
| `velocidad_tiempo` | visible, opcional | visible, **obligatorio** | visible, opcional | oculto |
| `velocidad_distancia` | visible, **obligatorio** | visible, opcional | visible, opcional | oculto |

¹ Regla cruzada: distancia y tiempo son opcionales **por separado** pero sin al menos
uno no se guarda. Error: *"Completá al menos Distancia Objetivo o Tiempo Objetivo."*

**Un `kind` desconocido no rompe nada**: muestra y valida cero campos. El default NO
es `liviano` a propósito — asumir un tipo es peor que no asumir.

## 3. Reparto en el form: qué va arriba y qué va en el acordeón

Regla implementada: **un campo va siempre visible si el usuario no puede guardar sin él.**
Eso incluye el caso cruzado de `liviano` — si sus dos campos estuvieran detrás del
acordeón "Detalles opcionales", el form sería imposible de completar sin abrirlo a
ciegas, y el error de la regla cruzada caería en un control invisible.

Consecuencia: `liviano` no tiene ningún campo opcional y **no muestra el acordeón**
(un botón que abre un cuerpo vacío es ruido). El acordeón se monta solo si
`hasOptionalFields`.

## 4. Cálculo de velocidad

`utils/exercise-speed.js`, función pura, sin imports de React.

```
velocidad_kmh = (distancia_metros / 1000) / (tiempo_minutos / 60)
```

- Redondeo a **1 decimal**, hecho en la función y no en la UI, porque `speed_kph` es
  `numeric(4,1)` en Postgres. Así lo que el usuario ve es lo que queda guardado.
- Devuelve `null` cuando no es calculable (falta un dato, cero, negativo, no numérico,
  `NaN`, `Infinity`). **Nunca `0` inventado** — mismo criterio que `utils/currency.js#formatArs`,
  donde `Number(null)` da 0 y pasa un `Number.isFinite` sin quejarse.
- El recálculo **pisa** el valor manual y **no hay flag de override** que lo inhiba
  (decisión de negocio explícita). Si el usuario edita velocidad a mano y no toca
  distancia ni tiempo, el valor se conserva.
- El helper va por la prop `hint`, que **comparte slot con `error`** (`fields.jsx:568`):
  cuando hay error, el helper desaparece. Es el comportamiento deseado, pero significa
  que no se pueden ver los dos a la vez.

## 5. `intensity` eliminado

Radio real (6 archivos): `IntensitySegmentedPicker` completo en
`create-exercise-modal.jsx` más su cableado en 8 lugares, `INTENSITY_ORDER`/`INTENSITY_META`
en `exercise-kind-meta.js`, las dos ramas de `buildExerciseStatLine`, `toExerciseModel`,
`toCreateExercisePayload`, los 12 seeds del mock, y 4 tests que lo assertaban.

Dos consecuencias que rompen en silencio si no se aceptan explícitamente:

- `hasOptionalData` decidía si el acordeón arranca abierto en edición; ahora solo mira
  los campos que el tipo puede tener.
- `buildExerciseStatLine` perdió una de sus ramas, así que los ejercicios que solo
  tenían `intensity` muestran línea vacía y cada caller cae a su fallback. Hay que
  verificar las 5 pantallas que la usan.

## 6. TabBar compartido

`components/shared/tab-bar.jsx` pasa de 0 semántica ARIA a tablist completo:

- `accessibilityRole="tablist"` / `"tab"` — **verificados** contra la lista de TalkBack
  leyendo `ReactAccessibilityDelegate.java`, igual que hace
  `__tests__/accessibility-roles.test.js`. `tabpanel` **no existe** en esa lista: si una
  pantalla lo necesita, va con el prop crudo `role`.
- `accessibilityState.selected` **y** `aria-selected` plano, porque `react-native-web@0.21`
  no implementa `accessibilityState` (mismo criterio que `SearchablePickerField`).
- Flechas `←`/`→`, `Home`/`End`, con wrap-around, y **roving tabindex** (solo la tab
  activa entra en el orden de tabulación).
- Solo en web: `findNodeHandle` tira en react-native-web y las flechas no aplican en nativo.

**Afecta 3 dominios**: `training-plans-screen`, `team-detail-screen`, `payments-screen`.
Verificar en las 4 pantallas.

## 7. Cambios requeridos en `paceron-backend` (Go) — no se hacen desde acá

1. **Enum `kind`**: agregar los 5 valores nuevos (o pasarlo a varchar validado).
2. **Migrar filas** con este mapeo:

   | viejo | nuevo |
   |---|---|
   | `walking` | `liviano` |
   | `jogging` | `ritmo_continuo` |
   | `elongation` | `elongacion` |
   | `cruising` | `ritmo_continuo` |
   | `running` | `velocidad_distancia` |

   **`jogging` y `cruising` colapsan al mismo tipo.** Como `ritmo_continuo` ahora exige
   distancia **y** tiempo, y hoy ambos campos son opcionales para cualquiera, **las filas
   migradas pueden quedar incompletas contra la matriz nueva**. Hay que definir si el
   backend relaja la validación de esas filas, si el frontend las marca para editar, o se
   piden los datos antes de migrar.
3. **Borrar la columna `intensity`** del schema, DTO y serializer.

## 8. Arista conocida, NO resuelta aquí

`PUT /exercises/{id}` es **reemplazo completo** (`BACKEND_TRAINING_PLANS_SPEC.md:137`),
pero `toCreateExercisePayload` **omite** las claves ausentes en vez de mandarlas como
`null`. Con la matriz nueva es más probable que un campo que era visible pase a estarlo y
deje de mandarse — el backend puede conservar el valor viejo. Borrar un campo opcional en
una edición puede no persistir.

No se "arregla" desde el front sin cambiar el contrato: manda `null` explícito es una
decisión del backend. Cubierto por un test que lo documenta
(`__tests__/normalizers.test.js`, "el mismo normalizer sirve para create y update").

## 9. Endurecimiento en el borde con la API

`toCreateExercisePayload` ahora también omite el string vacío, no solo `null`. El form
ya coerciona a `Number|null` antes de llamar, así que hoy nunca pasa `''` — pero mandarle
`''` a una columna `int` de Postgres es un 400, y el borde con la API no debería depender
de que el caller se acuerde.

## 10. Cobertura

| Archivo | Antes | Después |
|---|---|---|
| `toExerciseModel` / `toCreateExercisePayload` | **0** | 15 tests |
| matriz de campos | — (no existía) | 24 tests |
| cálculo de velocidad | — (no existía) | 25 tests |
| validadores por tipo | — (no existía) | 33 tests |
| preferencia del info box | — (no existía) | 11 tests |
| `exercise-kind-meta` | 7 | 21 |

Suite: **1143 → 1185**, sin test previo debilitado. `exercise-kind-meta.test.js` se
reescribió porque testeaba el modelo viejo por diseño (`intensity` + "cualquier
combinación es válida"); el cambio es intencional y está documentado acá y en el header
del archivo.

## 11. Fuera de alcance

- Unificar el `TabBar` local de `edit-profile-screen.jsx:39` con el compartido.
- `components/shared/section-tab-bar.jsx` (otro componente, usado por el calendario).
- `MUSCLE_GROUP_LABELS` vs `MUSCLE_GROUP_OPTIONS`: la duplicación es deliberada
  (`exercise-kind-meta.js:53-60` — evita arrastrar la cadena de imports que rompe Jest).

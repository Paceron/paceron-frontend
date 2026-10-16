# Spec Delta

## Purpose

Define cómo se mide la distancia recorrida durante el registro de una sesión en vivo, de
forma que la cifra que ve el corredor y la que se guarda de cada serie refleje movimiento
real. Cubre el ciclo de vida del muestreo de posición, el descarte de ruido y el
tratamiento de los reinicios de fase, para los dos flujos de registro (asíncrono y
presencial).

## ADDED Requirements

### Requirement: El muestreo de posición SHALL ser continuo durante toda la sesión

La app SHALL mantener **una única** suscripción de posición activa desde que el corredor
arranca la sesión hasta que la termina, en los dos flujos de registro. La suscripción SHALL
NOT crearse ni destruirse al cambiar de serie.

El motivo observable es que el primer fix de una suscripción recién abierta es siempre el
peor: búsqueda de satélites en frío, sin referencia previa y con el radio de error más
grande. Si la suscripción se abre y se cierra en cada serie, **todas** las SERIES arrancan
desde el peor fix posible en lugar de solo la primera.

#### Scenario: La segunda serie no paga un arranque en frío

Dado un corredor que ya viene de registrar su primera serie, cuando arranca la segunda
serie, entonces el primer punto de posición de esa segunda serie SHALL venir de la
suscripción que ya venía corriendo, y no de una suscripción recién abierta.

#### Scenario: El GPS se mantiene vivo entre series

Dado un corredor con el GPS habilitado en una sesión de varias series, cuando termina una
serie y arranca la siguiente, entonces la suscripción de posición SHALL continuar activa
durante el intervalo entre ambas, sin cerrarse ni reabrirse.

#### Scenario: La suscripción se cierra al terminar la sesión

Dado un corredor que terminó o canceló la sesión, cuando la pantalla de registro se
desmonta, entonces la suscripción de posición SHALL quedar liberada.

### Requirement: La distancia SHALL permanecer en cero cuando no hay desplazamiento real

Un tramo entre dos puntos de posición SHALL sumar distancia únicamente si su longitud
supera un umbral mínimo de desplazamiento. Ese umbral SHALL ser al menos un piso fijo en
metros y SHALL escalarse con el radio de error declarado por el punto nuevo, de modo que un
receptor menos preciso exija un movimiento mayor para contar.

Consecuencia observable: con el teléfono inmóvil, la distancia mostrada y la distancia
guardada de la serie SHALL permanecer en 0.

Un punto cuyo radio de error exceda el máximo aceptable SHALL descartarse, y al descartarse
no SHALL contribuir ni a la distancia ni a la trayectoria persistida.

#### Scenario: Quieto no acumula distancia

Dado un corredor que permanece inmóvil con buena señal durante un minuto, cuando se
recalcula la distancia de la serie, entonces la distancia SHALL ser 0 m, y no un valor
creciente con el tiempo.

#### Scenario: Correr cuenta la distancia real

Dado un corredor que se desplaza de forma continua, cuando se recalcula la distancia de la
serie, entonces cada tramo que supere el umbral SHALL sumarse a la distancia de esa serie.

#### Scenario: Un punto con radio de error enorme no cuenta

Dado un punto de posición cuyo radio de error declarado excede el máximo aceptable,
cuando se evalúa el tramo que llega a ese punto, entonces el tramo SHALL descartarse y la
distancia de la serie SHALL permanecer sin cambios.

### Requirement: El punto de referencia de una serie SHALL superar el filtro de calidad

La primera posición válida de una serie SHALL establecerse como referencia del tramo
siguiente solo si pasa el filtro de calidad. Si no lo pasa, el sistema SHALL seguir
esperando una posición posterior que sí lo pase, y SHALL NOT acumular distancia ni
persistir puntos a partir de una referencia inválida.

#### Scenario: El primer fix malo no se usa como referencia

Dado el arranque de una serie cuya primera posición tiene un radio de error inaceptable,
cuando llega una segunda posición con calidad aceptable, entonces el tramo entre ambas
SHALL evaluarse contra la segunda posición como referencia, y el desplazamiento de la
primera SHALL NOT contarse como movimiento.

#### Scenario: La referencia se usa a favor del contador

Dado un corredor que se mueve de forma continua durante una serie, cuando se evalúa cada
tramo, entonces el sistema SHALL usar como referencia la última posición aceptada, de modo
que la distancia suma el recorrido y no la suma de vaivenes.

### Requirement: Un tramo por debajo del umbral SHALL NOT avanzar la referencia ni persistirse

Cuando un tramo se acepta pero su longitud no supera el umbral mínimo de desplazamiento, el
sistema SHALL NOT modificar la referencia del tramo siguiente, SHALL NOT incrementar el
orden de los puntos persistidos y SHALL NOT escribir ese punto en el almacenamiento local.

El motivo es que aceptar un tramo de ruido como nuevo punto de referencia hace que el
ruido se filtre contra más ruido, en lugar de contra la última posición real conocida.

#### Scenario: El ruido no amplifica el error acumulado

Dado un corredor inmóvil emitiendo posiciones con ruido pequeño, cuando se procesan los
puntos de forma continua, entonces la referencia SHALL permanecer en la última posición
aceptada como desplazamiento real, y el número de puntos persistidos SHALL NOT crecer con
cada muestra de ruido.

### Requirement: Una pausa SHALL NOT atribuirse a la distancia de la serie

Al pausar una serie, el sistema SHALL descartar la referencia de posición vigente. El
primer tramo posterior a la reanudación SHALL evaluarse contra una posición obtenida
después de la reanudación, y no contra la posición de antes de la pausa.

El filtro de velocidad no cubre este caso: al dividir la distancia por un intervalo
temporal largo, cualquier re-localización durante la pausa produce una velocidad implícita
baja y resulta aceptada.

#### Scenario: Reanudar después de una pausa larga

Dado un corredor que pausó una serie durante varios minutos y la reanudó, cuando llega el
primer punto de posición posterior a la reanudación, entonces ese punto SHALL usarse como
referencia, y el desplazamiento ocurrido durante la pausa SHALL NOT sumarse a la distancia
de la serie.

#### Scenario: Los puntos de la pausa no cuentan

Dado un corredor con la serie en pausa, cuando llegan puntos de posición, entonces la
distancia de la serie SHALL permanecer sin cambios.

### Requirement: Un tramo sin intervalo temporal válido SHALL NOT aceptarse sin verificar

Cuando dos posiciones consecutivas no permiten calcular una velocidad —porque su
diferencia temporal es cero o negativa— el sistema SHALL tratar el tramo como no
verificable: SHALL NOT contabilizarlo como distancia sin más, y SHALL NOT persistirlo como
punto de la trayectoria.

#### Scenario: Dos posiciones con el mismo timestamp

Dado un receptor que entrega dos posiciones consecutivas con idéntica marca de tiempo,
cuando se evalúa el tramo entre ambas, entonces el tramo SHALL descartarse en lugar de
sumarse a la distancia de la serie.

### Requirement: Una serie sin medición SHALL distinguirse de una serie con cero metros

Cuando una serie termina sin haber obtenido ninguna posición válida, su distancia SHALL
quedar en un estado de "sin medir", distinguible de una distancia medida de 0 m. La
interfaz SHALL NOT presentar una serie sin medición como si hubiera medido cero metros, y
SHALL indicar que no hubo señal de GPS.

#### Scenario: Serie sin señal durante toda la duración

Dado un corredor que mantiene el teléfono cubierto durante toda una serie, cuando la serie
termina y se muestra el resumen, entonces la distancia SHALL aparecer como no medida y el
sistema SHALL informar que no se obtuvo señal, en lugar de mostrar 0 m como si fuera una
medición.

#### Scenario: Serie con señal y sin movimiento

Dado un corredor con señal GPS disponible que permanece inmóvil durante toda la serie,
cuando la serie termina y se muestra el resumen, entonces la distancia SHALL aparecer como
0 m, y ese 0 SHALL ser una medición válida, distinta del caso sin señal.

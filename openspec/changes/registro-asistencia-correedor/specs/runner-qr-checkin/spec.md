# Spec Delta

## Purpose

Permite que un **corredor** registre su asistencia a una sesión presencial
escaneando el QR de esa sesión con la cámara de la propia app, sin salir de ella ni
depender de una app de scanner externa. Incluye el estado de espera con la animación de
marca, el resultado con check verde o error, y el muro de login que retoma el flujo.

## ADDED Requirements

### Requirement: El sistema SHALL exponer el escáner solo a corredores y solo en mobile

La pantalla de registro por QR SHALL ser alcanzable desde el menú principal y SHALL
cumplir **las dos** condiciones: `activeRole === 'runner'` y plataforma mobile. La regla
de plataforma se aplica en el catálogo de rutas, que es la fuente única de la navegación,
y no en cada shell por separado.

#### Scenario: El corredor ve la entrada en mobile

Dado un usuario con `activeRole` `runner` en Android o iOS, cuando se abre el menú
principal, entonces la entrada **"Registrar asistencia"** aparece en la navegación.

#### Scenario: El entrenador no ve la entrada

Dado un usuario con `activeRole` `trainer`, cuando se abre el menú principal, entonces
la entrada **no** aparece, en ninguna plataforma.

#### Scenario: En web la ruta no está en la navegación

Dado cualquier usuario en web, cuando se abre el menú principal, entonces la entrada
**no** aparece. La ruta sigue siendo alcanzable por URL directa, para poder depurar.

#### Scenario: Se llega por URL sin cumplir las condiciones

Dado un usuario que llega a `/attendance/register` por URL, cuando no se cumple alguna de
las dos condiciones (no es corredor, o no es mobile), entonces la pantalla SHALL mostrar un
aviso explicando la condición que falta y SHALL NOT montar la cámara.

### Requirement: El corredor SHALL poder escanear el QR desde la app

La app SHALL incluir un escáner de QR propio que lea el código y extraiga los
identificadores `team_id` y `session_instance_id` de la URL que el backend codifica en el
QR. El QR SHALL seguir siendo una **URL https** y no un payload compacto, para que el
cartel impreso también sirva a quien lo escanee con Google Lens.

#### Scenario: Escaneo válido

Dado el corredor con la cámara apuntando al QR de una sesión, cuando el código se lee,
entonces la app SHALL extraer `team_id` y `session_instance_id` y SHALL disparar **un**
registro.

#### Scenario: Un código que no es de Paceron

Dado un código QR que no es una URL de Paceron, cuando se lee, entonces la app SHALL
mostrar un error y SHALL NOT intentar registrar.

#### Scenario: Una URL nuestra de otra pantalla

Dado un código QR que es una URL de Paceron pero de otra ruta, sin `team_id` y
`session_instance_id`, cuando se lee, entonces la app SHALL mostrar un error y SHALL NOT
intentar registrar.

#### Scenario: Un escaneo repetido no duplica el registro

Dado un registro en vuelo, cuando se escanea otro código antes de que resuelva, entonces
el segundo escaneo SHALL ser ignorado y SHALL NOT disparar una segunda request.

### Requirement: El sistema SHALL mostrar una espera a pantalla completa mientras registra

Mientras la request está en vuelo, la pantalla SHALL quedar grisada a pantalla completa con
una ventana emergente grande que muestre la animación del corredor corriendo y, debajo, la
leyenda **"Registrando asistencia"**. El fondo del overlay SHALL ser el mismo gris del asset de animación —`#979597`, medido del
archivo final—, para que el rectángulo de la imagen no se vea contra el fondo.

#### Scenario: La espera aparece y bloquea la pantalla

Dado que el corredor escaneó un código válido y la request está en vuelo, cuando se
muestra la interfaz, entonces el overlay gris a pantalla completa SHALL estar visible con
la animación y el texto "Registrando asistencia", y la pantalla SHALL bloquear la
interacción con el resto de la app.

#### Scenario: El asset de animación no se recorta

Dado el asset de marca, que es bicromático (la "D" negra y el corredor y los arcos
blancos) y está diseñado para fondo gris medio, cuando se usa en el overlay, entonces el
fondo SHALL conservarse y el overlay SHALL usar ese mismo gris, de modo que la "D" y el
corredor se vean **ambos**.

### Requirement: El sistema SHALL mostrar el resultado con check verde o error y un botón ACEPTAR

Cuando el backend responde, la ventana SHALL mostrar un icono, un mensaje y un botón
**ACEPTAR**. El texto del backend SHALL NOT mostrarse salvo en el error no clasificado. El
caso de asistencia ya registrada SHALL llevar check **verde**, porque la asistencia quedó
registrada.

#### Scenario: Asistencia registrada por primera vez

Dado que el backend responde `201`, cuando se muestra el resultado, entonces la ventana
SHALL mostrar un check **verde** y el mensaje de que la asistencia quedó registrada, con el
botón ACEPTAR.

#### Scenario: La asistencia ya estaba registrada

Dado que el backend responde `200`, cuando se muestra el resultado, entonces la ventana
SHALL mostrar un check **verde** y el mensaje de que ya estaba registrada, con el botón
ACEPTAR.

#### Scenario: El QR no es del equipo del corredor

Dado que el backend responde `403`, cuando se muestra el resultado, entonces la ventana
SHALL mostrar una X **roja** y un mensaje de que no pertenece a ese equipo, con el botón
ACEPTAR.

#### Scenario: El QR no es válido

Dado que el backend responde `400`, cuando se muestra el resultado, entonces la ventana
SHALL mostrar una X **roja** y un mensaje de que el QR no es válido, con el botón ACEPTAR.

#### Scenario: La sesión ya no existe

Dado que el backend responde `404`, cuando se muestra el resultado, entonces la ventana
SHALL mostrar una X **roja** y un mensaje de que la sesión ya no existe, con el botón
ACEPTAR.

#### Scenario: Error de red o no clasificado

Dado que la request falla por red o con un status no clasificado, cuando se muestra el
resultado, entonces la ventana SHALL mostrar una X **roja** y el mensaje real del backend,
con el botón ACEPTAR.

#### Scenario: ACEPTAR devuelve el control al escáner

Dado que se está mostrando un resultado, cuando se aprieta ACEPTAR, entonces la pantalla
SHALL volver a la fase de escaneo con la cámara activa de nuevo, y SHALL NOT navegar a
otra pantalla ni recargar datos.

### Requirement: El flujo SHALL continuar automáticamente después de iniciar sesión

Si el corredor no tiene sesión al entrar al escáner, la app SHALL dirigirlo a la pantalla
de login, y una vez que inicia sesión el flujo de registro SHALL continuar por su cuenta. Los
identificadores leídos del QR SHALL NOT perderse al pasar por login.

#### Scenario: Corredor sin sesión escanea

Dado un corredor sin sesión, cuando escanea un QR válido, entonces la app SHALL pedir el
login y SHALL preservar los identificadores leídos.

#### Scenario: El registro continúa solo después del login

Dado que el corredor acá de loguearse, cuando el login es exitoso, entonces la app SHALL
disparar el registro de la sesión leída **sin** que el corredor tenga que volver al menú ni
volver a escanear.

### Requirement: El sistema SHALL explicar en web que la función es de la app nativa

En web, la ruta SHALL responder con un aviso de que el registro por QR es una función de la
app nativa, y SHALL NOT intentar abrir la cámara ni registrar la asistencia.

#### Scenario: Se abre la ruta en web

Dado cualquier usuario en web, cuando se abre `/attendance/register`, entonces la pantalla
SHALL mostrar el aviso de app nativa y SHALL NOT pedir permiso de cámara ni disparar
ninguna request de registro.

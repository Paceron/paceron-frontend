# Design — Registro de asistencia del corredor por QR

## D1 — El QR sigue siendo una URL https, no un payload compacto

El QR está **impreso y colgado en la pared**. Aunque la app tenga escáner, hay corredores
que lo escanean con la cámara del teléfono porque no quieren —o no pueden— abrir la app.

Codificar algo tipo `PACERON:4:501` haría inservible el cartel para ese caso. Con una URL
https pasan los dos caminos:

| | cómo llega | qué hace |
|---|---|---|
| Con la app | escáner in-app | parsea la URL → registra |
| Sin la app | Google Lens | abre la URL → la web (D5) |

El escáner in-app parsea la URL del código, no un payload propio. Es la misma URL que ya
produce el backend: `<frontend>/attendance/register?team_id=&session_instance_id=`.

## D2 — Escáner in-app como vía principal, App Links descartados

App Links (`intentFilters` + `autoVerify` + `assetlinks.json` con la huella del keystore +
verificación de Google) es el camino más caro del change: hay que regenerar el dev client,
servir `assetlinks.json` en el dominio, y la huella del keystore de firma de EAS es un
**secreto de despliegue** que no está en el repo. Si la huella no coincide con la del APK
publicado, Android ignora la asociación y abre el browser, sin error visible.

El escáner in-app elimina esa categoría entera de riesgo, da mejor experiencia (no hay
viaje al browser ni diálogo de desambiguación) y aprovecha que **el endpoint de registro ya
existe**: `POST /api/v1/attendance/team/:team_id/session/:training_session_id`.

Queda como posible mejora futura, no como dependencia: si algún día se agrega, el QR es
una URL y no hay que rehacer el poster.

## D3 — El acceso vive en el catálogo de rutas, con una regla de plataforma

Los tres shells (`app-web-shell`, `app-web-shell-narrow`, `app-mobile-shell`) arman sus
items con `getRoutesByRole(activeRole)`, que hoy solo filtra por rol. La condición
"solo mobile" se agrega **en el catálogo**, como un flag `mobileOnly`, para no duplicar la
regla en tres call sites ni sacar el item a mano en un solo shell (que es como se rompe
cuando se agrega un cuarto shell).

`getRoutesByRole` sigue siendo la única fuente de qué se ve en la navegación, que es lo que
ya justifica su existencia.

Gates del acceso: **perfil corredor** (`role: 'runner'`, que ya filtra) **y mobile**
(`mobileOnly`, nuevo). La condición de "pertenece a un equipo" se dejó fuera a pedido
explícito del usuario para esta vuelta.

## D4 — El overlay de espera usa el gris del asset, no uno elegido

`video_loop_infinito_v2.gif` es **bicromático**: la "D" negra, el corredor y los arcos
**blancos**, sobre gris medio (el color exacto del asset optimizado es `#979597` — medido del archivo, no estimado: la cuantización a 64 colores corrió el fondo 2 unidades desde el `#959394` del original, y con el valor estimado quedaba una costura visible). Está diseñado para ese fondo — probamos
keying y queda mal por partida doble: sobre oscuro desaparece la "D", sobre claro
desaparecen el corredor y los arcos, y además el recorte deja los arcos fragmentados.

Entonces: el asset **conserva su fondo** y el overlay usa `#979597`, **medido del archivo
optimizado**, así el rectángulo del GIF empalma con el fondo y no se ve. El valor se mide
siempre del GIF final, no del original: cuantizar a paleta mueve el fondo un par de
unidades y con el número anterior quedaba una costura visible. Pedir "pantalla grisada" y que el fondo sea el del
asset son la misma decisión.

El GIF se optimizó antes de integrarlo: 4255 KB → 320 KB (93% menos), 600×338 → 260×146,
~10 s → **~1,2 s por vuelta**. La duración original era absurda para una espera: la request
tarda menos de un segundo, y 10 s se lee como algo trabado. A 20 fps entra en bucle sin
que se note el salto.

## D5 — La web sin sesión: se lo dice, no registra

El QR es una URL https, así que un corredor sin la app **cae en la versión web**. Y la web
no tiene sesión persistente: el token vive en Zustand + SecureStore, o sea que no hay
sesión en el browser.

Registrar desde la web implicaría un login en el navegador con la sesión en memoria, que
se pierde al cerrar la pestaña — el corredor tendría que loguearse de nuevo en cada
sesión presencial. Eso no lo hace nadie.

La web, entonces, **no registra**: explica que abra la app, con el link de la app. Es un
rechazo honesto de una capacidad que la plataforma no soporta, y no un error silencioso.

## D6 — El muro de login usa un store de intención pendiente, no un query param

El login hace `router.replace('/')` fijo: no acepta a dónde volver. Agregarle un
`?redirect=` sería útil en general, pero acá hay que anidar query params
(`/login?redirect=/attendance/register?team_id=4&...`) y el caso de uso es de una sola
vuelta.

Existe precedente exacto en el repo: `store/session-runtime-store.js#pendingSession` guarda
el destino de navegación con datos y la pantalla destino lo consume al montar. Se replica
el patrón: un store con `pendingCheckin` (team_id + session_instance_id) que el escáner
escribe antes de redirigir a login y consume al montar si hay sesión.

Se elige este patrón y no el query param porque **el store sobrevive a la caída de sesión
de `RequireAuth` sin depender de que el login lo pase adelante**, que es el punto donde un
query param se pierde si el usuario entra por otro camino.

## D7 — Los tres resultados se distinguen por status, no por el texto del backend

`POST /api/v1/attendance/team/:team_id/session/:training_session_id` responde:

| status | `message` | En pantalla |
|---|---|---|
| `201` | `asistencia registrada` | check verde, "Asistencia registrada" |
| `200` | `esta asistencia fue previamente registrada` | check verde, "Ya estaba registrada" |
| `403` | — | X rojo, "No pertenecés a este equipo" |
| `400` | — | X rojo, "El QR no es válido" |
| `404` | — | X rojo, "La sesión ya no existe" |
| otros / red | — | X rojo, `error.message` real |

El texto del backend **no se muestra**: el front redacta el propio, para no filtrar nada
de la sesión. Es el mismo criterio que ya usa la pantalla del entrenador.

El `200` va con **check verde y no con X**: la asistencia quedó registrada, que es lo que el
corredor quería. Ponerle error sería mentirle sobre si su sesión quedó en el cartel.

## D8 — Un solo estado, tres fases, sin polling

La pantalla tiene una máquina de fases explícita: `scanning` → `submitting` → `result`.
En `submitting` muestra el overlay gris con la animación y "Registrando asistencia". Cuando
la request resuelve, pasa a `result`.

**No hay polling ni estado intermedio de la request**: es un POST que resuelve o falla. Más
estados serían código para un caso que no existe.

## D9 — El botón ACEPTAR devuelve el control sin recargar

El resultado es un estado terminal con un botón. ACEPTAR vuelve a la fase `scanning`, con la
cámara de nuevo activa. **No** navega a otro lado ni refresca nada: el corredor suele
tener que escanear en un grupo de 20 personas y cada uno tiene que volver a empezar por
su cuenta.

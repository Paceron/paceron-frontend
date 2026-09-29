# Registro de asistencia del corredor por QR

El entrenador ya puede generar el QR de una sesión presencial y colgarlo (o imprimirlo
como PDF). Falta el otro lado: que el **corredor** lo escanee y quede registrado.

Hoy el QR no sirve para eso. `GET /attendance/qr` codificaba
`<base>/api/v1/attendance/team/{id}/session/{id}` — **la API**. Al escanearlo con la cámara
del teléfono o Google Lens, el link abre el browser contra la API y devuelve un 401 en
crudo. Ninguno de los resultados que un corredor puede encontrarse (registrado, ya
registrado, error) es alcanzable.

Este change hace las dos mitades: **arregla la URL que codifica el QR** (ya hecho en el
backend, `9c0dfe5`) y **construye la pantalla del corredor** que la atiende.

## Alcance

- Escáner de QR **dentro de la app** (vía principal, la que se elige).
- El QR **sigue siendo una URL https**, así el cartel impreso también sirve para quien
  escanee con Google Lens sin tener la app.
- El acceso al escáner vive en el **menú principal**, solo en **perfil corredor** y solo
  en **mobile**.
- Overlay de espera a pantalla completa con la animación de marca y el texto
  "Registrando asistencia".
- Resultado con check verde o X rojo y un botón ACEPTAR que devuelve el control.
- Muro de login que, si no hay sesión, manda a login y **retoma el escaneo** después.

## Fuera de alcance (y por qué)

- **App Links de Android** (abrir la app desde Google Lens). Se evaluó y se descartó: es
  el camino más caro del change —`intentFilters` + `assetlinks.json` con la huella del
  keystore de firma + verificación de Google— y el escáner in-app lo vuelve innecesario.
  El QR es una URL, así que si algún día se quiere, se agrega encima sin rehacer nada.
- **Escáner propio en la web.** El escaneo por cámara en `react-native-web` es poco
  confiable y el caso real es móvil. En web la ruta responde que abra la app.
- **Reintento automático** si falla la request. El botón ACEPTAR devuelve el control y el
  corredor vuelve a escanear.
- **Aviso de "ya registraste asistencia" en la sesión de hoy.** La app ya tiene
  `session-runtime`; esto no lo toca.

## Dependencias

| Dep | Estado | Nota |
|---|---|---|
| `expo-camera` | **nueva** | escaneo de barcode. Módulo nativo → rebuild del dev client |
| `react-native-svg` | ya instalada | — |
| `react-native-reanimated` | ya instalada | — |
| `expo-linear-gradient` | ya instalada | — |

Sin Lottie: la animación se delivery como **GIF**, que `Image` renderiza nativamente en
las tres plataformas sin dependencia nueva.

## Riesgos

- **[R1] `expo-camera` es un módulo nativo más.** Hay que regenerar el dev client. El
  riesgo es que funcione en web (donde `getUserMedia` anda) y falle en Android, que es
  justo donde se usa. Se verifica en device temprano, no al final.
- **[R2] Permiso de cámara.** Android 13+ exige declararlo en `app.config.js`
  (`android.permissions`) además del pedido en runtime. Olvidar la declaración hace que
  el pedido en runtime falle.
- **[R3] El GIF de la animación es bicromático.** La "D" es negra y el corredor y los
  arcos son blancos: está diseñado **para fondo gris medio**. Sobre fondo oscuro
  desaparece la "D"; sobre fondo claro desaparecen el corredor y los arcos. Por eso el
  overlay usa `#979597` (medido del archivo final), el mismo gris del asset, y **no se le quita el fondo**.
- **[R4] App Links como ruta secundaria.** El QR es una URL https. Sin App Links, un
  corredor sin la app cae en la web, que no tiene sesión persistente. Hay que decidir
  qué muestra esa web (ver D5).

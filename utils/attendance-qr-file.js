// Logo del documento + impresión del PDF de asistencia (tareas 7.5 y 7.6).
//
// Las dos cosas que viven acá comparten la misma razón de ser: el PDF se arma en
// el cliente (D8) y `printToFileAsync` renderiza en un contexto SIN acceso a
// archivos locales (por eso el logo tiene que ir embebido como data URI), y en
// web `expo-print` no sabe renderizar nada (ver openBrowserPrintDialog más
// abajo). Son código de plataforma — imports de módulos nativos, `document`,
// `window` — así que no hay forma de testearlo con Jest: se verifica en el
// preview web y en device. Lo testeable (el HTML del documento) ya está aislado
// en utils/attendance-qr-pdf.js como función pura.
//
// La decisión de plataforma sale de utils/platform.js (`isWeb`), no de un
// `Platform.OS` inline: es la convención del repo y evita que las dos ramas se
// desincronicen.
//
// Sobre el nombre del archivo: la tarea 7.5 lo pedía como
// `utils/attendance-qr-logo.js`, y el header de utils/attendance-qr-pdf.js:13
// sigue nombrando ese path. Acá se llama attendance-qr-file.js porque también
// contiene la impresión (7.6), que no tiene nada que ver con el logo; si en
// algún momento se prefiere el nombre de la tarea, hay que actualizar esa
// referencia en attendance-qr-pdf.js.

import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';

import { isWeb } from './platform';

// El logo embebido. NO es `assets/paceron-logo-symbol.png`: ese archivo no
// existe (los candidatos reales están en assets/ y se verificaron con `sips`).
//
// Se usa el lockup completo `logo_paceron_light_mode.png` (1586×437, PNG con
// alfa, ~80 KB → ~107 KB de base64) y no el isotipo suelto por tres razones:
//  1. Es el mismo asset que usa la marca en la app
//     (components/brand/paceron-brand.jsx:13), con el margen transparente ya
//     recortado — se ve igual en pantalla y en papel.
//  2. La variante "light" es tinta oscura sobre fondo transparente, que es
//     exactamente lo que necesita una hoja blanca. La "dark"
//     (logo_paceron_dark_mode.png) es el wordmark en blanco: sobre el papel
//     Blanco del documento sería INVISIBLE. El tema de la app no aplica acá —
//     el papel es blanco siempre, con light mode o dark mode.
//  3. El isotipo suelto (paceron-symbol-transparent.png, 548×503) además
//     upscalea: la caja `.logo` del PDF lo limita a 13mm de alto
//     (attendance-qr-pdf.js:202), o sea ~150px a 300dpi, y el lockup (1586px de
//     ancho) entra por el otro límite — 42mm ≈ 496px — bajando a ~11,5mm sin
//     magnificar un solo pixel.
//
// Descartado el `.jpeg` del isotipo (paceron-logo-symbol.jpeg, 16 KB): pesa
// menos pero es JPEG sin alfa — sobre el blanco del documento se ve la caja
// opaca y los bordes del isotipo salen con ringing. R4 (el base64 agranda el
// HTML) se resuelve con el caché de módulo de abajo, no bajando la calidad del
// logo: 107 KB se leen UNA vez por sesión de app.
const LOGO_ASSET = require('../assets/logo_paceron_light_mode.png');

// `data:image/<tipo>;base64,<bytes>` con el mime del propio asset, no un
// 'image/png' hardcodeado: si algún día se cambia el logo por otro formato, el
// data URI sigue siendo correcto sin tocar esta función.
//
// No se reusa `toQrDataUri` de utils/attendance-qr-image.js aunque el
// resultado sea idéntico: esa función existe para el `qr_code_base64` que
// devuelve el backend y su contrato es "data URI de PNG"; el logo es un asset
// de build con tipo propio. Couplarlas haría que un cambio en el QR (formato,
// prefijo) arrastre también al logo.
function toDataUri(asset, base64) {
  const mime = asset?.type ? `image/${asset.type}` : 'image/png';
  return `data:${mime};base64,${base64}`;
}

// Camino NATIVO: expo-asset resuelve (y descarga a caché) el asset, y
// expo-file-system lee los bytes.
//
// Sobre la API: la versión instalada es expo-file-system@19.0.24 (SDK 54), que
// **ya no expone la API vieja en el export principal**. `readAsStringAsync`
// (y `EncodingType`, `writeAsStringAsync`, todo eso) viven hoy únicamente en el
// subpath `expo-file-system/legacy` — verificado contra
// node_modules/expo-file-system/build/index.d.ts, que solo reexporta
// ./FileSystem (las clases), ./ExpoFileSystem.types y ./legacyWarnings. Por eso
// acá se usa la API nueva, la que corresponde: `new File(uri).base64()`
// (node_modules/expo-file-system/src/FileSystem.ts:71, con el método `base64()`
// declarado en ExpoFileSystem.types.d.ts). No es una preferencia de estilo:
// `/legacy` es la API deprecada, que además emite warnings
// (src/legacyWarnings.ts) y es la que se va a quitar; la tarea 7.5 la nombraba
// porque el enunciado se escribió contra la API vieja.
//
// El import del módulo es seguro en web (expo-file-system tiene shim web, solo
// un `console.warn` al CONSTRUIR un File), pero en web esta función no se
// llama nunca: ver readLogoDataUriOnWeb.
async function readLogoDataUriOnNative() {
  const asset = await Asset.fromModule(LOGO_ASSET).downloadAsync();

  const localUri = String(asset?.localUri || '').trim();
  if (!localUri) {
    throw new Error('expo-asset no devolvió un localUri para el logo del documento');
  }

  const base64 = await new File(localUri).base64();
  return toDataUri(asset, base64);
}

// Un blob a data URI, en web. `FileReader.readAsDataURL` ya arma el prefijo
// completo con el mime correcto del blob, así que no hay que reconstruir el
// base64 a mano con `btoa` (que además revienta con buffers grandes por el
// límite de tamaño del stack de argumentos, y obliga a chunkear).
function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el logo del documento'));
    reader.onload = () => {
      const value = String(reader.result || '');
      // El chequeo es defensivo pero barato: si el server devolvió algo que no
      // es una imagen (un index.html de error en dev, por ejemplo) esto evita
      // embeber HTML en el documento como si fuera un logo.
      if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(value)) {
        reject(new Error('La respuesta del asset del logo no es una imagen'));
        return;
      }
      resolve(value);
    };

    reader.readAsDataURL(blob);
  });
}

// Camino WEB: `expo-file-system` NO existe en web de verdad — el shim
// (src/ExpoFileSystem.web.ts) solo hace `console.warn('expo-file-system is not
// supported on web')` y sus métodos no existen, así que `new File(uri).base64()`
// en web es un TypeError. Por eso el atajo es el que propone la tarea: `fetch`
// del URI del asset + `FileReader`.
//
// Y acá hay un detalle de la API de expo-asset: en web `downloadAsync()` NO
// descarga nada — src/ExpoAsset.web.ts es literalmente `return url` — y solo
// suma un `getImageInfoAsync` (un `<img>` que se tira después) para completar
// width/height, que este documento no usa. O sea: `asset.uri` ya es la URL del
// asset (en dev, la del server de Metro; en el export web, la ruta estática del
// bundle) y `fetch` de ella funciona en los dos casos. Por eso acá NO se llama
// `downloadAsync()` —llamarlo solo agrega un request que puede rechazar y
// taparía el error real— y se usa `localUri || uri` para no depender de esa
// diferencia.
async function readLogoDataUriOnWeb() {
  const asset = Asset.fromModule(LOGO_ASSET);
  const url = String(asset?.localUri || asset?.uri || '').trim();
  if (!url) {
    throw new Error('expo-asset no devolvió una URI para el logo del documento');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo cargar el logo del documento (HTTP ${response.status})`);
  }

  return blobToDataUri(await response.blob());
}

// Caché a NIVEL DE MÓDULO (R4): el logo es un asset de build, no cambia en
// runtime, y sus ~107 KB de base64 los vuelve a generar `File#base64()` en
// cada apertura del modal. Se lee una vez por sesión de app y las llamadas
// siguientes reciben la misma promesa.
//
// La promesa (no el resultado) es lo que se cachea, para que dos callers que
// abren el modal a la vez compartan la lectura en vez de duplicarla.
//
// Un FALLO se cachea como `null` —el documento igual sale, con el wordmark de
// texto de attendance-qr-pdf.js:139-143— pero NO se deja cacheado: la entrada
// se borra, así el próximo intento (o sea, la próxima apertura del modal) vuelve
// a intentar leerlo. Un logo faltante se puede deber a un asset todavía
// descargándose, y cachear el fallo para toda la sesión dejaría el cartel sin
// logo para siempre.
let logoDataUriPromise = null;

export function resolveLogoDataUri() {
  if (logoDataUriPromise) return logoDataUriPromise;

  const pending = (isWeb ? readLogoDataUriOnWeb() : readLogoDataUriOnNative())
    .catch((error) => {
      // El documento no depende del logo, así que el fallo no se propaga: se
      // devuelve `null` y el PDF usa el wordmark de texto. Se loguea igual en
      // dev porque en producción el síntoma es invisible (un cartel sin logo, sin
      // ningún error) — mismo criterio que el `__DEV__` de
      // components/team/team-subscription-screen.jsx:117.
      if (__DEV__) console.warn('[attendance-qr] no se pudo resolver el logo:', error?.message);
      return null;
    })
    .then((value) => {
      if (!value && logoDataUriPromise === pending) logoDataUriPromise = null;
      return value;
    });

  logoDataUriPromise = pending;
  return pending;
}

// Cuánto se deja el iframe de impresión montado después de imprimir. El
// `print()` del navegador es bloqueante en desktop (vuelve cuando se cierra el
// diálogo) pero en Safari/iOS abre una hoja y vuelve enseguida: sacar el iframe
// en el mismo tick puede cancelar la impresión en curso. Un segundo de margen
// es barato para no arriesgar que no salga nada.
const PRINT_IFRAME_CLEANUP_DELAY_MS = 1000;

// Diálogo de impresión del navegador sobre un HTML arbitrario.
//
// Por qué NO `expo-print` en web, que es lo que parece natural: verificado en
// node_modules/expo-print/build/ExponentPrint.web.js — `print()` y
// `printToFileAsync()` son AMBOS `window.print()` y tiran el `options.html` a
// la basura. O sea, `printAsync({ html })` en web no imprime nuestro documento:
// abre el diálogo de impresión de la PÁGINA DE LA APP (el shell entero con la
// grilla de asistencia). Por eso el iframe.
//
// El iframe va con `srcdoc` (no con `document.write`): es un solo evento `load`
// — el del documento completo, imágenes del QR y del logo adentro — y es
// same-origin, así que `contentWindow.print()` está permitido. Va de 0×0 con
// `position: 'fixed'` en vez de `display:none`/`visibility:hidden` porque hay
// navegadores que no renderizan (ni imprimen) el contenido de un iframe oculto
// de verdad.
//
// Si el iframe no puede imprimir, se RECHAZA en vez de caer a `window.print()`:
// el fallback imprimiría la página de la app, que es peor que un error — el
// entrenador se lleva un cartel en papel lleno de interfaz, creyendo que es el
// documento. El caller (7.8) ya tiene el camino de error del spec ("La descarga
// falla": aviso + el modal sigue abierto).
export function openBrowserPrintDialog(html) {
  const documentHtml = String(html ?? '').trim();
  if (!documentHtml) {
    return Promise.reject(new Error('No hay documento para imprimir'));
  }
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.reject(new Error('No hay navegador disponible para imprimir'));
  }

  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('title', 'Impresión del documento de asistencia');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    // Antes de appendear, para que el `load` de más abajo sea el del documento
    // del srcdoc y no el del about:blank inicial.
    frame.srcdoc = documentHtml;

    let settled = false;

    frame.onload = () => {
      if (settled) return;
      settled = true;

      try {
        const frameWindow = frame.contentWindow;
        if (!frameWindow || typeof frameWindow.print !== 'function') {
          throw new Error('El navegador no permite imprimir el documento desde un iframe');
        }
        frameWindow.focus();
        frameWindow.print();
        setTimeout(() => frame.remove(), PRINT_IFRAME_CLEANUP_DELAY_MS);
        resolve();
      } catch (error) {
        frame.remove();
        reject(error);
      }
    };

    frame.onerror = () => {
      if (settled) return;
      settled = true;
      frame.remove();
      reject(new Error('No se pudo cargar el documento para imprimir'));
    };

    document.body.appendChild(frame);
  });
}

// Imprime el documento (el HTML que arma buildAttendanceQrHtml) y devuelve
// QUÉ PASÓ, porque en las dos plataformas el resultado sirve para cosas
// distintas y el caller tiene que poder distinguirlo:
//
//   nativo → { uri }          el PDF quedó en el cache de la app. Hay archivo,
//                              se puede compartir (shareAttendanceQr).
//   web   → { printed: true }  no hay archivo: se abrió el diálogo del
//                              navegador, y "Guardar como PDF" lo hace el
//                              usuario desde ahí. `expo-sharing` no aplica (el
//                              `uri` de archivo no existe en web).
//
// La distinción es estructural, no un flag: se chequea `'uri' in result`.
export async function printAttendanceQr(html) {
  const documentHtml = String(html ?? '').trim();
  if (!documentHtml) {
    throw new Error('No hay documento para imprimir');
  }

  if (isWeb) {
    await openBrowserPrintDialog(documentHtml);
    return { printed: true };
  }

  // El archivo va al cache directory de la app (docs de expo-print): es
  // borrable por el sistema, y no importa acá porque el uso es inmediato — se
  // comparte recién después de imprimir, y si el archivo desapareciera entre
  // medio el catcher tiene el camino de error del spec. Volver a imprimir
  // regenera el PDF desde cero (el HTML se arma de nuevo, no se reusa el
  // archivo).
  const result = await Print.printToFileAsync({ html: documentHtml });

  const uri = String(result?.uri || '').trim();
  if (!uri) {
    // expo-print resolvió sin error pero sin archivo: se prefiere fallar acá
    // que devolver `{ printed: true }` en nativo, que haría creer al caller que
    // ya se imprimió cuando no se imprimió nada (mismo "fallar ruidoso" de
    // buildAttendanceQrHtml cuando falta el QR — mejor un toast de error que
    // un cartel que nunca se generó).
    throw new Error('expo-print no devolvió el archivo del documento');
  }

  return { uri };
}

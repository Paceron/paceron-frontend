# Aceptación de Términos y Condiciones en el registro

## Contexto

La HU original pide que un administrador pueda definir, versionar y disponibilizar los términos y condiciones para que los usuarios los acepten al registrarse. Administrar el documento desde un backoffice es demasiado alcance para este momento del proyecto, así que se resuelve la parte que aporta valor hoy: **el corredor que se registra tiene que aceptar los términos para poder crear la cuenta**.

El documento queda hardcodeado en el frontend, y el propio contrato aclara que los cambios se comunican por email — eso reemplaza el versionado dinámico que pedía la HU.

**Alcance: solo frontend.** No se toca el backend ni el payload de registro. La aceptación es un gate de UI.

### Criterios de aceptación cubiertos

| Criterio | Cómo se cubre |
|---|---|
| Documentos legibles y responsive (web y mobile) | Modal con `ScrollView`, `max-w-2xl max-h-[80%]`, sin breakpoints |
| Si no acepta, se bloquea el registro con mensaje claro | `formValid` exige `termsAccepted`; error inline al intentar enviar |
| Textos según Ley 25.326 y RGPD | Responsabilidad del contenido del `.md`, que carga el equipo. La spec provee el placeholder |

### Fuera de alcance

- Backoffice de administración del documento
- Versionado dinámico o registro de qué versión aceptó cada usuario
- Persistir la aceptación en backend
- Documento separado de política de privacidad (va como sección dentro del mismo documento)

## Decisiones

### 1. El contenido vive en un `.md` real, no en un `.js`

Se evaluaron tres caminos:

| Opción | Trade-off |
|---|---|
| `.js` con template literal | Cero config, pero el archivo no es un `.md` |
| **`.md` real + transformer en Metro** | **Elegida.** Archivo real, sin dependencias nuevas, a costa de tocar config de build |
| `.md` + `babel-plugin-inline-import` + `react-native-markdown-display` | Descartada: dos librerías sin mantenimiento (2022 y 2023) contra React 19 / RN 0.81 |

Se verificó que Metro **no** resuelve `.md` de fábrica (ni en `sourceExts` ni en `assetExts`), y que **NativeWind no ocupa el `babelTransformerPath`** — lo deja en el de Expo (`@expo/metro-config/build/babel-transformer.js`, que exporta un único `transform`). Eso hace que encadenar un transformer propio sea envolver una sola función, sin conflicto con NativeWind.

### 2. Parser propio en vez de librería

El subset de markdown que necesita un contrato legal es chico, y un parser propio tiene una ventaja concreta con las convenciones del repo: **es lógica pura, o sea testeable en `__tests__/`**, mientras que los componentes visuales se verifican a mano (el repo no hace tests de render).

Por eso se separa en dos piezas:
- `utils/markdown-parser.js` — string → tokens. Pura, testeada.
- `components/legal/markdown-view.jsx` — tokens → componentes RN. Visual, verificada a mano.

### 3. El checkbox va suelto, antes del botón de submit

Las tres secciones del registro (`SectionCard`) son colapsables. Si el checkbox viviera dentro de una, podría quedar oculto justo cuando está bloqueando el envío. Como es un gate del formulario completo y no de una sección, va fuera de las secciones, inmediatamente antes de "Crear cuenta".

### 4. El modal es solo lectura

Cerrarlo no acepta nada — la aceptación es siempre un acto explícito sobre el checkbox. Tampoco se exige scrollear hasta el final para poder aceptar.

## Arquitectura

```
data/legal/terms-and-conditions.md      contenido (placeholder, lo llena el equipo)
metro-markdown-transformer.js           wrapper del transformer de Expo
metro.config.js                         + 'md' en sourceExts, + babelTransformerPath

utils/markdown-parser.js                string → tokens   (lógica pura, testeada)
components/legal/markdown-view.jsx      tokens → RN       (visual)
components/legal/terms-modal.jsx        modal responsive de solo lectura
components/forms/checkbox-field.jsx     checkbox reutilizable (no existía en el repo)

components/auth/register-screen.jsx     integración: estado, gate y error inline
__tests__/markdown-parser.test.js       tests del parser
```

Flujo: el `.md` se inlinea como string en build → `MarkdownView` lo parsea y renderiza dentro de `TermsModal` → `RegisterScreen` controla la visibilidad del modal y el estado del checkbox.

### Build: cómo se carga el `.md`

`metro-markdown-transformer.js` envuelve el transformer de Expo. Si el archivo termina en `.md`, reemplaza el source por un módulo que exporta el contenido como string, y delega todo lo demás sin cambios:

```js
const upstream = require('@expo/metro-config/build/babel-transformer.js');

module.exports.transform = function ({ src, filename, ...rest }) {
  if (filename.endsWith('.md')) {
    src = `module.exports = ${JSON.stringify(src)};`;
  }
  return upstream.transform({ src, filename, ...rest });
};
```

En `metro.config.js`, después de `withNativeWind`: se agrega `'md'` a `resolver.sourceExts` y se apunta `transformer.babelTransformerPath` al wrapper.

> **Caveat operativo:** cambiar la config de Metro no es hot-reloadable. La primera vez después de este cambio hay que arrancar con `npx expo start -c`. Queda documentado en `CLAUDE.md`.

### Parser: contrato y alcance

```
parseMarkdown(md) → Block[]

Block = { type: 'heading', level: 1|2|3, spans: Span[] }
      | { type: 'paragraph', spans: Span[] }
      | { type: 'list', items: Span[][] }

Span  = { text: string, bold: boolean }
```

**Soportado:**

| Sintaxis | Resultado |
|---|---|
| `# `, `## `, `### ` | heading nivel 1, 2, 3 |
| `#### ` o más | se degrada a nivel 3 |
| Líneas de texto consecutivas | un párrafo (se unen con espacio) |
| Línea en blanco | separa bloques |
| `- ` o `* ` al inicio de línea | item de lista |
| `**texto**` | span en negrita, dentro de cualquier bloque |

**No soportado** (se renderiza como texto literal, no rompe): itálica, links, imágenes, tablas, code blocks/inline code, blockquotes, listas numeradas, listas anidadas, reglas horizontales, HTML embebido.

Ese alcance se documenta **en el header de `utils/markdown-parser.js`**, que es la fuente de verdad — esta spec puede quedar desactualizada, el archivo no.

### Estilos

Según `docs/STYLE_CONTRACT.md`:

| Elemento | Clases |
|---|---|
| h1 | `text-xl font-bold text-slate-900 dark:text-white` |
| h2 | `text-base font-bold text-slate-900 dark:text-white` |
| h3 | `text-sm font-semibold text-slate-900 dark:text-white` |
| Párrafo | `text-sm leading-5 text-slate-600 dark:text-slate-300` |
| Span negrita | `font-semibold text-slate-900 dark:text-white` |
| Item de lista | bullet `•` + texto de párrafo |
| Card del modal | `rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-surface` |
| Backdrop | `bg-black/50` |
| Link "Términos y Condiciones" | `font-semibold text-primary` (igual que "Iniciá sesión") |
| Error del checkbox | `mt-1.5 text-xs text-red-500 dark:text-red-400` |

Modal con `animationType="fade"` y `transparent`, siguiendo `deactivate-account-modal.jsx`.

### Estructura y textos exactos

**Modal** (`TermsModal`), de arriba a abajo:
1. Header fijo: título "Términos y Condiciones" (`text-lg font-bold`) + `Pressable` con ícono `close` a la derecha
2. Cuerpo: `ScrollView` con el `MarkdownView`, separado del header por un `border-b`
3. Footer fijo: botón "Cerrar" a ancho completo, estilo secundario (`rounded-full border`)

Header y footer quedan fuera del `ScrollView` para que sigan accesibles con contratos largos. Se cierra por el ícono, por el botón, y por `onRequestClose` (back de Android).

**Checkbox** en el registro:

```
[✓] Acepto los Términos y Condiciones
```

donde "Términos y Condiciones" es un `Pressable` inline con `font-semibold text-primary` que abre el modal. Tocar el texto **no** cambia el estado del checkbox: abrir el documento y aceptarlo son acciones distintas. La caja y la palabra "Acepto los" sí togglean.

**Textos de error y fallback:**

| Situación | Texto |
|---|---|
| Intenta enviar sin aceptar | `Debe aceptar los términos y condiciones para continuar.` |
| El `.md` viene vacío o no se pudo cargar | `No se pudo cargar el documento. Escribinos a soporte para recibirlo por email.` |

### Integración en el registro

```js
const [termsAccepted, setTermsAccepted] = useState(false);
const [showTerms, setShowTerms] = useState(false);

const formValid = personalOk && passwordValid && passwordsMatch && termsAccepted;

const termsError = touched.terms && !termsAccepted
  ? 'Debe aceptar los términos y condiciones para continuar.'
  : null;
```

En `handleSubmit` se suma `touch('terms')` junto al resto de los `touch(...)`, antes del early return por `!formValid`. El botón "Crear cuenta" ya refleja `formValid` en su estilo, así que el bloqueo visual sale gratis.

## Manejo de errores

| Caso | Comportamiento |
|---|---|
| Usuario intenta enviar sin aceptar | Error inline bajo el checkbox; no se llama a la API |
| El `.md` está vacío o no se pudo cargar | El modal muestra un párrafo de fallback en vez de quedar en blanco |
| El `.md` tiene sintaxis no soportada | Se renderiza como texto literal; nunca lanza |

El parser no tira excepciones: cualquier línea que no matchee una regla conocida cae a párrafo.

## Testing

**`__tests__/markdown-parser.test.js`** (lógica pura, convención del repo):
- headings de nivel 1/2/3, y `####+` degradando a 3
- párrafo simple y párrafo multilínea unido
- líneas en blanco separando bloques
- listas con `-` y con `*`
- `**negrita**` sola, al inicio/medio/fin, y con varias en la misma línea
- asteriscos sin cerrar → texto literal, no rompe
- string vacío → array vacío
- sintaxis no soportada (link, tabla, code block) → texto literal

**Verificación visual manual** (el repo no hace tests de render):
- Web angosta y ancha: el modal no desborda y scrollea
- Dark mode en modal, checkbox y error
- Mobile real: el modal respeta el área segura y el scroll funciona

**Regresión:** `npm test` y `npm run lint` en verde. La regla `local/require-native-id` exige `nativeID` + `testID` en todo componente visual nuevo.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El cambio de config de Metro rompe el bundling para el resto del equipo | El wrapper delega todo lo que no es `.md` sin tocarlo. Se prueba web + verificación de `npm test` antes de mergear |
| Alguien pega un contrato con sintaxis no soportada y queda feo | El alcance está documentado en el header del parser; degrada a texto literal en vez de romper |
| El caveat de `expo start -c` genera confusión | Documentado en `CLAUDE.md` y en esta spec |

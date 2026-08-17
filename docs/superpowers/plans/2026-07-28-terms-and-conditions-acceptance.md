# Terms and Conditions Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el corredor tenga que aceptar los términos y condiciones —leíbles en un modal responsive— para poder completar el registro.

**Architecture:** El contrato vive en un `.md` real que Metro inlinea como string vía un transformer propio. Un parser puro convierte ese string en tokens (testeable en Jest), y un componente separado los renderiza como componentes de React Native. El registro suma un checkbox que bloquea el submit.

**Tech Stack:** Expo (React Native + React Native Web), NativeWind, Expo Router, Jest + jest-expo, Metro.

## Global Constraints

- **Solo frontend.** No se toca el backend ni el payload de registro (`toRegisterPayload`).
- **`nativeID` + `testID` obligatorios** en todo componente visual (`View`, `Text`, `Pressable`, `Modal`, `ScrollView`, etc.). Lo enforcea la regla ESLint `local/require-native-id`; `npm run lint` debe quedar en verde.
- **Nombres de id en kebab-case**, con scope propio del componente (ej. `terms-modal-close-button`), nunca genéricos.
- **Theming inline** con NativeWind y modificador `dark:`. Nada de tokens centralizados.
- **Responsive web obligatorio**: el modal funciona en cualquier ancho de viewport, sin breakpoints.
- **Sin tests de render de componentes** — es convención del repo. Solo se testea lógica pura en `__tests__/`.
- **Commits:** Conventional Commits, subject en **inglés**, cuerpo (si hace falta) en español.
- **Textos de UI exactos** (copiados de la spec, no reformular):
  - Checkbox: `Acepto los ` + link `Términos y Condiciones`
  - Error: `Debe aceptar los términos y condiciones para continuar.`
  - Fallback: `No se pudo cargar el documento. Escribinos a soporte para recibirlo por email.`
  - Título del modal: `Términos y Condiciones`
  - Botón del modal: `Cerrar`
- **Rama:** `feature/terms-and-conditions-acceptance` (ya creada desde `develop`, con la spec commiteada).

**Spec:** `docs/superpowers/specs/2026-07-28-terms-and-conditions-acceptance-design.md`

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `data/legal/terms-and-conditions.md` | El contrato. Contenido, cero lógica. |
| `metro-markdown-transformer.js` | Convierte `.md` en módulo JS en build time. |
| `metro.config.js` | Registra el transformer y la extensión `md`. |
| `utils/markdown-parser.js` | String markdown → tokens. Pura. Documenta el subset soportado. |
| `components/legal/markdown-view.jsx` | Tokens → componentes RN estilados. |
| `components/legal/terms-modal.jsx` | Modal responsive de solo lectura. |
| `components/forms/checkbox-field.jsx` | Checkbox reutilizable con label y error. |
| `components/auth/register-screen.jsx` | Integra checkbox + modal + gate de submit. |
| `__tests__/markdown-parser.test.js` | Tests del parser. |
| `__tests__/metro-markdown-transformer.test.js` | Test del wrapping del transformer. |

---

### Task 1: Carga de `.md` vía Metro

Sienta la base: sin esto, ningún componente puede importar el contrato. Incluye la config de build, el archivo de contenido y la nota en `CLAUDE.md` porque el caveat de `expo start -c` lo necesita cualquiera que baje la rama.

**Files:**
- Create: `data/legal/terms-and-conditions.md`
- Create: `metro-markdown-transformer.js`
- Create: `__tests__/metro-markdown-transformer.test.js`
- Modify: `metro.config.js`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nada (primera task).
- Produces: `import termsMarkdown from '../../data/legal/terms-and-conditions.md'` devuelve el contenido del archivo como `string`. `metro-markdown-transformer.js` exporta `wrapMarkdown(src: string): string` y `transform(opts): object`.

- [ ] **Step 1: Escribir el test del wrapping**

El riesgo real acá es el escapado: un contrato con comillas, backslashes o backticks tiene que sobrevivir la conversión a módulo JS.

Crear `__tests__/metro-markdown-transformer.test.js`:

```javascript
const { wrapMarkdown } = require('../metro-markdown-transformer.js');

// Evalúa el módulo generado y devuelve lo que exporta, que debe ser
// exactamente el markdown original.
function evalWrapped(src) {
  const module = { exports: null };
  // eslint-disable-next-line no-new-func
  new Function('module', wrapMarkdown(src))(module);
  return module.exports;
}

describe('wrapMarkdown', () => {
  test('genera un módulo que exporta el contenido tal cual', () => {
    expect(evalWrapped('# Hola')).toBe('# Hola');
  });

  test('preserva saltos de línea', () => {
    expect(evalWrapped('# Titulo\n\nParrafo')).toBe('# Titulo\n\nParrafo');
  });

  test('preserva comillas dobles y simples', () => {
    const src = 'El "usuario" acepta los \'terminos\'';
    expect(evalWrapped(src)).toBe(src);
  });

  test('preserva backticks y backslashes', () => {
    const src = 'Ruta C:\\datos y `codigo` inline';
    expect(evalWrapped(src)).toBe(src);
  });

  test('preserva acentos y ñ', () => {
    const src = '# Términos y Condiciones\n\nSección de privacidad.';
    expect(evalWrapped(src)).toBe(src);
  });

  test('soporta contenido vacío', () => {
    expect(evalWrapped('')).toBe('');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest __tests__/metro-markdown-transformer.test.js`
Expected: FAIL — `Cannot find module '../metro-markdown-transformer.js'`

- [ ] **Step 3: Crear el transformer**

Crear `metro-markdown-transformer.js` en la raíz del repo:

```javascript
// Permite importar archivos .md como string desde el código de la app.
//
// Metro no resuelve .md de fábrica (no está ni en sourceExts ni en
// assetExts). Este wrapper delega todo al transformer de Expo, salvo los
// .md, que convierte en un módulo JS que exporta el contenido como string.
//
// NativeWind no ocupa el slot de babelTransformerPath (lo deja en el de
// Expo), así que encadenarlo acá no entra en conflicto.
const upstream = require('@expo/metro-config/build/babel-transformer.js');

// JSON.stringify se encarga del escapado de comillas, backslashes y
// saltos de línea. No usar template literals: un backtick en el contrato
// rompería el módulo generado.
function wrapMarkdown(src) {
  return `module.exports = ${JSON.stringify(src)};`;
}

function transform({ src, filename, ...rest }) {
  if (filename.endsWith('.md')) {
    return upstream.transform({ src: wrapMarkdown(src), filename, ...rest });
  }
  return upstream.transform({ src, filename, ...rest });
}

module.exports = { transform, wrapMarkdown };
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx jest __tests__/metro-markdown-transformer.test.js`
Expected: PASS — 6 tests

- [ ] **Step 5: Registrar el transformer en Metro**

Reemplazar el contenido completo de `metro.config.js`:

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = withNativeWind(getDefaultConfig(__dirname), { input: './nativewind.css' });

// Habilita `import contenido from './archivo.md'` (ver metro-markdown-transformer.js).
config.resolver.sourceExts = [...config.resolver.sourceExts, 'md'];
config.transformer.babelTransformerPath = require.resolve('./metro-markdown-transformer.js');

module.exports = config;
```

- [ ] **Step 6: Crear el archivo de contrato con el placeholder**

Crear `data/legal/terms-and-conditions.md`:

```markdown
# Términos y Condiciones

Lorem ipsum xd

## 1. Aceptación

Lorem ipsum dolor sit amet. Al crear una cuenta aceptás estos términos.

Si actualizamos este documento, te avisamos por **email** a la casilla con la que te registraste.

## 2. Datos personales

Tratamos tus datos según la Ley 25.326 de Protección de Datos Personales y el RGPD.

- Podés pedir acceso a tus datos.
- Podés pedir que los rectifiquemos.
- Podés pedir que los eliminemos.

## 3. Contacto

Escribinos a soporte para cualquier consulta sobre estos términos.
```

- [ ] **Step 7: Verificar que el bundler resuelve el `.md`**

Crear un archivo temporal `verify-md-import.js` en la raíz:

```javascript
// Temporal: verifica que el transformer resuelve .md. Se borra en el paso 8.
const fs = require('fs');
const { wrapMarkdown } = require('./metro-markdown-transformer.js');

const raw = fs.readFileSync('./data/legal/terms-and-conditions.md', 'utf8');
const module_ = { exports: null };
new Function('module', wrapMarkdown(raw))(module_);

console.log('longitud:', module_.exports.length);
console.log('contiene placeholder:', module_.exports.includes('Lorem ipsum xd'));
console.log('contiene heading:', module_.exports.startsWith('# Términos'));
```

Run: `node verify-md-import.js`
Expected: `longitud:` mayor a 0, y ambos `contiene ...: true`

Después arrancar el bundler web para confirmar que la config de Metro no rompió nada:

Run: `npx expo start --web -c`
Expected: compila y abre la app sin errores de bundling. Cortar con Ctrl+C.

- [ ] **Step 8: Borrar el archivo temporal**

Run: `rm verify-md-import.js`

- [ ] **Step 9: Documentar el caveat en CLAUDE.md**

En `CLAUDE.md`, agregar al final de la sección `## Quirks conocidos` un bullet nuevo:

```markdown
- Los archivos `.md` se pueden importar como string desde el código (ej. el contrato en `data/legal/terms-and-conditions.md`), gracias a `metro-markdown-transformer.js` enganchado en `metro.config.js`. **Cambiar config de Metro no es hot-reloadable:** después de bajar una rama que la toque, arrancar una vez con `npx expo start -c`. El renderer (`components/legal/markdown-view.jsx`) soporta solo un subset de markdown — el alcance exacto está documentado en el header de `utils/markdown-parser.js`.
```

- [ ] **Step 10: Verificar lint y tests**

Run: `npm run lint && npm test`
Expected: lint sin errores; Jest en verde con la suite existente + los 6 tests nuevos.

- [ ] **Step 11: Commit**

```bash
git add metro.config.js metro-markdown-transformer.js data/legal/terms-and-conditions.md __tests__/metro-markdown-transformer.test.js CLAUDE.md
git commit -m "feat(legal): load markdown files as strings via metro transformer"
```

---

### Task 2: Parser de markdown

**Files:**
- Create: `utils/markdown-parser.js`
- Create: `__tests__/markdown-parser.test.js`

**Interfaces:**
- Consumes: nada de tasks anteriores (es lógica pura, independiente del `.md`).
- Produces:
  - `parseMarkdown(md: string): Block[]`
  - `parseInline(text: string): Span[]`
  - `Span = { text: string, bold: boolean }`
  - `Block = { type: 'heading', level: 1|2|3, spans: Span[] } | { type: 'paragraph', spans: Span[] } | { type: 'list', items: Span[][] }`

- [ ] **Step 1: Escribir los tests del parser**

Crear `__tests__/markdown-parser.test.js`:

```javascript
import { parseMarkdown, parseInline } from '../utils/markdown-parser.js';

describe('parseInline', () => {
  test('texto sin formato es un solo span', () => {
    expect(parseInline('hola mundo')).toEqual([{ text: 'hola mundo', bold: false }]);
  });

  test('negrita sola', () => {
    expect(parseInline('**hola**')).toEqual([{ text: 'hola', bold: true }]);
  });

  test('negrita en el medio', () => {
    expect(parseInline('antes **medio** despues')).toEqual([
      { text: 'antes ', bold: false },
      { text: 'medio', bold: true },
      { text: ' despues', bold: false },
    ]);
  });

  test('varias negritas en la misma linea', () => {
    expect(parseInline('**a** y **b**')).toEqual([
      { text: 'a', bold: true },
      { text: ' y ', bold: false },
      { text: 'b', bold: true },
    ]);
  });

  test('asteriscos sin cerrar quedan literales', () => {
    expect(parseInline('esto **no cierra')).toEqual([{ text: 'esto **no cierra', bold: false }]);
  });
});

describe('parseMarkdown', () => {
  test('string vacio devuelve array vacio', () => {
    expect(parseMarkdown('')).toEqual([]);
  });

  test('null o undefined devuelven array vacio', () => {
    expect(parseMarkdown(null)).toEqual([]);
    expect(parseMarkdown(undefined)).toEqual([]);
  });

  test('headings de nivel 1, 2 y 3', () => {
    const blocks = parseMarkdown('# Uno\n\n## Dos\n\n### Tres');
    expect(blocks).toEqual([
      { type: 'heading', level: 1, spans: [{ text: 'Uno', bold: false }] },
      { type: 'heading', level: 2, spans: [{ text: 'Dos', bold: false }] },
      { type: 'heading', level: 3, spans: [{ text: 'Tres', bold: false }] },
    ]);
  });

  test('headings de nivel 4 o mas se degradan a 3', () => {
    const blocks = parseMarkdown('#### Cuatro\n\n##### Cinco');
    expect(blocks.map((b) => b.level)).toEqual([3, 3]);
  });

  test('parrafo simple', () => {
    expect(parseMarkdown('Hola mundo')).toEqual([
      { type: 'paragraph', spans: [{ text: 'Hola mundo', bold: false }] },
    ]);
  });

  test('lineas consecutivas se unen en un parrafo', () => {
    expect(parseMarkdown('linea uno\nlinea dos')).toEqual([
      { type: 'paragraph', spans: [{ text: 'linea uno linea dos', bold: false }] },
    ]);
  });

  test('linea en blanco separa parrafos', () => {
    const blocks = parseMarkdown('uno\n\ndos');
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.type === 'paragraph')).toBe(true);
  });

  test('lista con guion', () => {
    expect(parseMarkdown('- uno\n- dos')).toEqual([
      {
        type: 'list',
        items: [[{ text: 'uno', bold: false }], [{ text: 'dos', bold: false }]],
      },
    ]);
  });

  test('lista con asterisco', () => {
    const blocks = parseMarkdown('* uno\n* dos');
    expect(blocks[0].type).toBe('list');
    expect(blocks[0].items).toHaveLength(2);
  });

  test('negrita dentro de heading y de item de lista', () => {
    const blocks = parseMarkdown('# Hola **mundo**\n\n- item **fuerte**');
    expect(blocks[0].spans).toEqual([
      { text: 'Hola ', bold: false },
      { text: 'mundo', bold: true },
    ]);
    expect(blocks[1].items[0]).toEqual([
      { text: 'item ', bold: false },
      { text: 'fuerte', bold: true },
    ]);
  });

  test('texto en negrita al inicio de linea no se confunde con lista', () => {
    const blocks = parseMarkdown('**Importante** para todos');
    expect(blocks[0].type).toBe('paragraph');
  });

  test('lista seguida de parrafo cierra la lista', () => {
    const blocks = parseMarkdown('- uno\ntexto suelto');
    expect(blocks.map((b) => b.type)).toEqual(['list', 'paragraph']);
  });

  test('sintaxis no soportada queda como texto literal', () => {
    const blocks = parseMarkdown('| a | b |\n\n> cita\n\n[link](http://x.com)');
    expect(blocks).toHaveLength(3);
    expect(blocks.every((b) => b.type === 'paragraph')).toBe(true);
    expect(blocks[2].spans[0].text).toBe('[link](http://x.com)');
  });

  test('soporta saltos de linea de Windows', () => {
    const blocks = parseMarkdown('# Uno\r\n\r\nParrafo');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph']);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx jest __tests__/markdown-parser.test.js`
Expected: FAIL — `Cannot find module '../utils/markdown-parser.js'`

- [ ] **Step 3: Implementar el parser**

Crear `utils/markdown-parser.js`. El header documenta el alcance — es la fuente de verdad, la spec puede envejecer:

```javascript
// Parser de un subset acotado de markdown, pensado para documentos legales
// (términos y condiciones). Es lógica pura y sin dependencias, para poder
// testearla sin montar componentes.
//
// SOPORTADO
//   # / ## / ###     heading nivel 1, 2, 3
//   #### o más       se degrada a nivel 3
//   texto suelto     párrafo; líneas consecutivas se unen con espacio
//   línea en blanco  separa bloques
//   - texto          item de lista
//   * texto          item de lista
//   **texto**        negrita, dentro de cualquier bloque
//
// NO SOPORTADO — se renderiza como texto literal, nunca lanza excepción
//   itálica, links, imágenes, tablas, code blocks, código inline,
//   blockquotes, listas numeradas, listas anidadas, reglas horizontales,
//   HTML embebido.
//
// Si algún día hace falta más que esto, conviene evaluar una librería en
// vez de seguir estirando este archivo.

const BOLD_PATTERN = /\*\*(.+?)\*\*/g;
const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
// Exige espacio después del marcador para no confundir "* item" con "*itálica*"
// ni con "**negrita**" al inicio de línea.
const LIST_ITEM_PATTERN = /^[-*]\s+(.*)$/;

const MAX_HEADING_LEVEL = 3;

// Divide una línea en spans, marcando los tramos en negrita.
export function parseInline(text) {
  const spans = [];
  let lastIndex = 0;
  let match;

  BOLD_PATTERN.lastIndex = 0;
  while ((match = BOLD_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    spans.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    spans.push({ text: text.slice(lastIndex), bold: false });
  }

  return spans.length > 0 ? spans : [{ text, bold: false }];
}

// Convierte un documento markdown en una lista de bloques renderizables.
export function parseMarkdown(md) {
  if (typeof md !== 'string' || md.length === 0) return [];

  const blocks = [];
  let paragraphLines = [];
  let currentList = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: 'paragraph', spans: parseInline(paragraphLines.join(' ')) });
    paragraphLines = [];
  };

  const flushList = () => {
    if (currentList === null) return;
    blocks.push(currentList);
    currentList = null;
  };

  for (const rawLine of md.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line === '') {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = HEADING_PATTERN.exec(line);
    if (heading !== null) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: Math.min(heading[1].length, MAX_HEADING_LEVEL),
        spans: parseInline(heading[2].trim()),
      });
      continue;
    }

    const listItem = LIST_ITEM_PATTERN.exec(line);
    if (listItem !== null) {
      flushParagraph();
      if (currentList === null) currentList = { type: 'list', items: [] };
      currentList.items.push(parseInline(listItem[1].trim()));
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx jest __tests__/markdown-parser.test.js`
Expected: PASS — 19 tests

- [ ] **Step 5: Verificar la suite completa y el lint**

Run: `npm run lint && npm test`
Expected: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add utils/markdown-parser.js __tests__/markdown-parser.test.js
git commit -m "feat(legal): add markdown parser for legal documents"
```

---

### Task 3: Renderer de markdown

**Files:**
- Create: `components/legal/markdown-view.jsx`

**Interfaces:**
- Consumes: `parseMarkdown` de `utils/markdown-parser.js` (Task 2).
- Produces: `<MarkdownView content={string} idPrefix={string} />`. `idPrefix` default `'markdown-view'`; se usa para construir los `nativeID`/`testID` de los nodos internos.

- [ ] **Step 1: Crear el componente**

Crear `components/legal/markdown-view.jsx`:

```jsx
import { Text, View } from 'react-native';
import { parseMarkdown } from '../../utils/markdown-parser.js';

// Renderiza el subset de markdown que soporta utils/markdown-parser.js.
// Las clases siguen docs/STYLE_CONTRACT.md.

const HEADING_CLASS = {
  1: 'text-xl font-bold text-slate-900 dark:text-white',
  2: 'text-base font-bold text-slate-900 dark:text-white',
  3: 'text-sm font-semibold text-slate-900 dark:text-white',
};

const PARAGRAPH_CLASS = 'text-sm leading-5 text-slate-600 dark:text-slate-300';
const BOLD_CLASS = 'font-semibold text-slate-900 dark:text-white';

const FALLBACK_TEXT =
  'No se pudo cargar el documento. Escribinos a soporte para recibirlo por email.';

function renderSpans(spans, idPrefix) {
  return spans.map((span, index) => (
    <Text
      key={index}
      className={span.bold ? BOLD_CLASS : undefined}
      nativeID={`${idPrefix}-span-${index}`}
      testID={`${idPrefix}-span-${index}`}
    >
      {span.text}
    </Text>
  ));
}

export function MarkdownView({ content, idPrefix = 'markdown-view' }) {
  const blocks = parseMarkdown(content);

  if (blocks.length === 0) {
    return (
      <Text
        className={PARAGRAPH_CLASS}
        nativeID={`${idPrefix}-fallback`}
        testID={`${idPrefix}-fallback`}
      >
        {FALLBACK_TEXT}
      </Text>
    );
  }

  return (
    <View nativeID={idPrefix} testID={idPrefix}>
      {blocks.map((block, index) => {
        const blockId = `${idPrefix}-block-${index}`;

        if (block.type === 'heading') {
          return (
            <Text
              key={index}
              className={`mb-2 mt-4 ${HEADING_CLASS[block.level]}`}
              nativeID={blockId}
              testID={blockId}
            >
              {renderSpans(block.spans, blockId)}
            </Text>
          );
        }

        if (block.type === 'list') {
          return (
            <View key={index} className="mb-3" nativeID={blockId} testID={blockId}>
              {block.items.map((item, itemIndex) => {
                const itemId = `${blockId}-item-${itemIndex}`;
                return (
                  <View
                    key={itemIndex}
                    className="mb-1 flex-row gap-2"
                    nativeID={itemId}
                    testID={itemId}
                  >
                    <Text
                      className={PARAGRAPH_CLASS}
                      nativeID={`${itemId}-bullet`}
                      testID={`${itemId}-bullet`}
                    >
                      •
                    </Text>
                    <Text
                      className={`flex-1 ${PARAGRAPH_CLASS}`}
                      nativeID={`${itemId}-text`}
                      testID={`${itemId}-text`}
                    >
                      {renderSpans(item, itemId)}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }

        return (
          <Text
            key={index}
            className={`mb-3 ${PARAGRAPH_CLASS}`}
            nativeID={blockId}
            testID={blockId}
          >
            {renderSpans(block.spans, blockId)}
          </Text>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Verificar lint y tests**

Run: `npm run lint && npm test`
Expected: lint sin errores (confirma que todos los `nativeID`/`testID` están); Jest en verde.

- [ ] **Step 3: Commit**

```bash
git add components/legal/markdown-view.jsx
git commit -m "feat(legal): add markdown renderer component"
```

---

### Task 4: Checkbox reutilizable

No existe ningún checkbox en el repo, así que se crea en `components/forms/` junto al resto de los campos.

**Files:**
- Create: `components/forms/checkbox-field.jsx`

**Interfaces:**
- Consumes: nada de tasks anteriores. El check usa el color `#111518` (`onPrimary` del `STYLE_CONTRACT`) hardcodeado, porque va siempre sobre fondo `primary` y no cambia con el tema.
- Produces: `<CheckboxField checked={bool} onChange={(next: boolean) => void} error={string|null} idPrefix={string}>{label}</CheckboxField>`. `children` es el contenido del label; el componente lo envuelve en el área presionable.

- [ ] **Step 1: Crear el componente**

Crear `components/forms/checkbox-field.jsx`:

```jsx
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Checkbox con label presionable y error opcional debajo.
// El label se pasa como children para permitir texto enriquecido (ej. un
// link inline que abre un modal); un <Text onPress> anidado maneja su
// propio toque sin togglear el checkbox.
export function CheckboxField({ checked, onChange, error, idPrefix, children }) {
  return (
    <View className="mb-2" nativeID={idPrefix} testID={idPrefix}>
      <Pressable
        className="flex-row items-center gap-3 py-1"
        nativeID={`${idPrefix}-pressable`}
        testID={`${idPrefix}-pressable`}
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View
          className={`h-5 w-5 items-center justify-center rounded border-2 ${
            checked
              ? 'border-primary bg-primary'
              : error
                ? 'border-red-400 dark:border-red-800'
                : 'border-slate-300 dark:border-slate-600'
          }`}
          nativeID={`${idPrefix}-box`}
          testID={`${idPrefix}-box`}
        >
          {checked ? (
            <MaterialCommunityIcons color="#111518" name="check-bold" size={14} />
          ) : null}
        </View>

        <View className="flex-1" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          {children}
        </View>
      </Pressable>

      {error ? (
        <Text
          className="mt-1.5 text-xs text-red-500 dark:text-red-400"
          nativeID={`${idPrefix}-error`}
          testID={`${idPrefix}-error`}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Verificar lint y tests**

Run: `npm run lint && npm test`
Expected: todo en verde.

- [ ] **Step 3: Commit**

```bash
git add components/forms/checkbox-field.jsx
git commit -m "feat(forms): add reusable checkbox field"
```

---

### Task 5: Modal de términos

**Files:**
- Create: `components/legal/terms-modal.jsx`

**Interfaces:**
- Consumes: `MarkdownView` de `components/legal/markdown-view.jsx` (Task 3); el contrato desde `data/legal/terms-and-conditions.md` (Task 1).
- Produces: `<TermsModal visible={bool} onClose={() => void} />`.

- [ ] **Step 1: Crear el modal**

Crear `components/legal/terms-modal.jsx`. Header y footer quedan fuera del `ScrollView` para que sigan accesibles con contratos largos:

```jsx
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { MarkdownView } from './markdown-view.jsx';
import termsMarkdown from '../../data/legal/terms-and-conditions.md';

// Modal de solo lectura con el contrato. Cerrarlo no acepta nada: la
// aceptación es siempre un acto explícito sobre el checkbox del registro.
export function TermsModal({ visible, onClose }) {
  const colors = useThemeColors();

  return (
    <Modal
      nativeID="terms-modal"
      testID="terms-modal"
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View
        className="flex-1 items-center justify-center bg-black/50 px-4"
        nativeID="terms-modal-backdrop"
        testID="terms-modal-backdrop"
      >
        <View
          className="max-h-[80%] w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-surface"
          nativeID="terms-modal-card"
          testID="terms-modal-card"
        >
          <View
            className="flex-row items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800"
            nativeID="terms-modal-header"
            testID="terms-modal-header"
          >
            <Text
              className="text-lg font-bold text-slate-900 dark:text-white"
              nativeID="terms-modal-title"
              testID="terms-modal-title"
            >
              Términos y Condiciones
            </Text>
            <Pressable
              className="h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID="terms-modal-close-icon"
              testID="terms-modal-close-icon"
              onPress={onClose}
              accessibilityLabel="Cerrar"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={20} />
            </Pressable>
          </View>

          <ScrollView
            className="px-6 py-4"
            nativeID="terms-modal-scroll"
            testID="terms-modal-scroll"
          >
            <MarkdownView content={termsMarkdown} idPrefix="terms-modal-content" />
          </ScrollView>

          <View
            className="border-t border-slate-200 px-6 py-4 dark:border-slate-800"
            nativeID="terms-modal-footer"
            testID="terms-modal-footer"
          >
            <Pressable
              className="h-11 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              nativeID="terms-modal-close-button"
              testID="terms-modal-close-button"
              onPress={onClose}
            >
              <Text
                className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                nativeID="terms-modal-close-button-label"
                testID="terms-modal-close-button-label"
              >
                Cerrar
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Verificar lint y tests**

Run: `npm run lint && npm test`
Expected: todo en verde.

- [ ] **Step 3: Commit**

```bash
git add components/legal/terms-modal.jsx
git commit -m "feat(legal): add responsive terms and conditions modal"
```

---

### Task 6: Integración en el registro

**Files:**
- Modify: `components/auth/register-screen.jsx`

**Interfaces:**
- Consumes: `CheckboxField` (Task 4), `TermsModal` (Task 5).
- Produces: nada para tasks posteriores (es la última).

- [ ] **Step 1: Agregar los imports**

En `components/auth/register-screen.jsx`, después de la línea que importa `StrengthBar` (última del bloque de imports):

```jsx
import { StrengthBar, PasswordRequirementsList } from '../forms/password-strength.jsx';
import { CheckboxField } from '../forms/checkbox-field.jsx';
import { TermsModal } from '../legal/terms-modal.jsx';
```

- [ ] **Step 2: Agregar el estado**

Después de `const [loading, setLoading] = useState(false);`:

```jsx
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
```

- [ ] **Step 3: Sumar el gate a la validación**

Reemplazar la línea de `formValid`:

```jsx
  const formValid = personalOk && passwordValid && passwordsMatch;
```

por:

```jsx
  const formValid = personalOk && passwordValid && passwordsMatch && termsAccepted;

  const termsError =
    touched.terms && !termsAccepted
      ? 'Debe aceptar los términos y condiciones para continuar.'
      : null;
```

- [ ] **Step 4: Marcar el campo como tocado al enviar**

En `handleSubmit`, agregar `touch('terms')` después de `touch('confirm');`:

```jsx
    touch('confirm');
    touch('terms');

    if (!formValid) return;
```

- [ ] **Step 5: Insertar el checkbox y el modal**

Entre el cierre del último `</SectionCard>` (el de Contraseña) y el `<Pressable>` del botón "Crear cuenta", insertar:

```jsx
      <CheckboxField
        checked={termsAccepted}
        error={termsError}
        idPrefix="register-screen-terms"
        onChange={setTermsAccepted}
      >
        <Text
          className="text-sm text-slate-600 dark:text-slate-300"
          nativeID="register-screen-terms-text"
          testID="register-screen-terms-text"
        >
          Acepto los{' '}
          <Text
            className="font-semibold text-primary"
            nativeID="register-screen-terms-link"
            testID="register-screen-terms-link"
            onPress={() => setShowTerms(true)}
          >
            Términos y Condiciones
          </Text>
        </Text>
      </CheckboxField>

      <TermsModal onClose={() => setShowTerms(false)} visible={showTerms} />
```

Nota: el botón "Crear cuenta" ya usa `formValid` para su estilo, así que el bloqueo visual sale sin cambios adicionales.

- [ ] **Step 6: Verificar lint y tests**

Run: `npm run lint && npm test`
Expected: todo en verde.

- [ ] **Step 7: Verificación visual en web**

Run: `npx expo start --web -c`

Confirmar en `/register`:
1. El checkbox aparece entre la sección Contraseña y el botón "Crear cuenta", sin tildar.
2. Con el formulario completo pero el checkbox sin tildar, el botón "Crear cuenta" se ve deshabilitado (gris).
3. Al tocar "Crear cuenta" sin aceptar, aparece `Debe aceptar los términos y condiciones para continuar.` en rojo bajo el checkbox.
4. Tocar el texto `Términos y Condiciones` abre el modal **sin** tildar el checkbox.
5. El modal muestra el heading, los párrafos, la negrita de `**email**` y la lista con bullets.
6. El modal scrollea y el header/footer quedan fijos.
7. "Cerrar" (botón y X) cierra el modal.
8. Tildar el checkbox habilita el botón y limpia el error.
9. Achicar la ventana a ~375px: el modal no desborda y sigue usable.
10. Alternar a dark mode: modal, checkbox y error legibles.

- [ ] **Step 8: Commit**

```bash
git add components/auth/register-screen.jsx
git commit -m "feat(auth): require terms acceptance to complete registration"
```

---

## Verificación final

- [ ] `npm run lint` en verde
- [ ] `npm test` en verde (suite existente + 25 tests nuevos)
- [ ] Los 10 puntos de verificación visual de la Task 6, paso 7
- [ ] Verificación en mobile real (Expo Go): el modal respeta el área segura y scrollea

## Notas de riesgo

**El `<Text onPress>` anidado dentro del `Pressable` del checkbox.** El comportamiento esperado es que tocar el link abra el modal sin togglear el checkbox (React Native le da el toque al responder más interno). Es el único punto del plan que depende de un detalle de propagación de eventos, y está cubierto por el punto 4 de la verificación visual. Si en algún caso togglea además de abrir el modal, la solución es sacar el link fuera del `Pressable` y ponerlo como una línea aparte debajo del checkbox.

**Después de la Task 1, el dev server necesita `npx expo start -c` una vez.** Cambiar `metro.config.js` no es hot-reloadable; sin el flag, el import del `.md` falla con un error de resolución que parece un bug del código y no lo es.

// Parser de un subset acotado de markdown, pensado para documentos legales
// (términos y condiciones). Es lógica pura y sin dependencias, para poder
// testearla sin montar componentes.
//
// SOPORTADO
//   # / ## / ###     heading nivel 1, 2, 3
//   #### a ######    se degradan a nivel 3
//   texto suelto     párrafo; líneas consecutivas se unen con espacio
//   línea en blanco  separa bloques
//   - texto          item de lista
//   * texto          item de lista
//   **texto**        negrita, dentro de cualquier bloque
//
// NO SOPORTADO — no lanza excepción, pero "texto literal" solo es preciso
//   línea por línea: si la sintaxis no soportada ocupa varias líneas
//   seguidas (sin línea en blanco de por medio), esas líneas se UNEN en
//   un solo párrafo corrido, igual que pasaría con texto plano.
//   itálica, links, imágenes, tablas, code blocks, código inline,
//   blockquotes, listas numeradas, reglas horizontales, HTML embebido,
//   y 7 o más '#' seguidos (igual que CommonMark, deja de ser un heading
//   y cae a párrafo).
//
// CASO PARTICULAR — listas anidadas no se detectan como tales: cada línea
// se recorta (trim) antes de evaluarla, así que un item indentado
// ("  - nested") pierde la indentación y queda como un item más de la
// misma lista, en vez de quedar como texto literal o marcarse distinto.
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

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

  test('headings de nivel 4 a 6 se degradan a 3', () => {
    const blocks = parseMarkdown('#### Cuatro\n\n##### Cinco\n\n###### Seis');
    expect(blocks.map((b) => b.level)).toEqual([3, 3, 3]);
  });

  test('7 o mas almohadillas dejan de ser heading y caen a parrafo', () => {
    const blocks = parseMarkdown('####### Siete');
    expect(blocks).toEqual([
      { type: 'paragraph', spans: [{ text: '####### Siete', bold: false }] },
    ]);
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

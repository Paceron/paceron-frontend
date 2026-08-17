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
